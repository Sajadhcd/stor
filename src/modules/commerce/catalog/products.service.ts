import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { AttributeValidationService } from './attribute-definitions/attribute-validation.service.js';
import { normalizeAttributeKey } from './attribute-definitions/attribute-key.util.js';
import { CatalogSearchRepository } from './repositories/catalog-search.repository.js';
import { ProductSearchIndexRepository } from '../search/repositories/product-search-index.repository.js';

function getCasingVariants(key: string, originalDefName?: string): string[] {
  const variants = new Set<string>();
  variants.add(key);
  variants.add(key.toLowerCase());
  variants.add(key.toUpperCase());
  if (key.length > 0) {
    variants.add(key.charAt(0).toUpperCase() + key.slice(1).toLowerCase());
  }
  if (originalDefName) {
    variants.add(originalDefName);
    variants.add(originalDefName.trim());
  }
  return Array.from(variants);
}


@Injectable()
export class ProductsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    private readonly attributeValidation: AttributeValidationService,
    private readonly catalogSearch: CatalogSearchRepository,
    private readonly searchIndex: ProductSearchIndexRepository,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  async findAll(query?: ProductQueryDto) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || 'global';
    const cacheKey = `tenant:${tenantId}:products:${JSON.stringify(query || {})}`;

    const cached = await this.cache.get<PaginatedResponseDto<unknown>>(cacheKey);
    if (cached) return cached;

    const result = await this.db.exec(async (tx) => {
      const take = query?.take || query?.limit || 20;
      const skip = query?.skip || ((query?.page || 1) - 1) * take;

      let items: any[] = [];
      let total = 0;

      if (query?.search && query.search.trim() !== '') {
        const definitions = await tx.attributeDefinition.findMany({
          where: { tenantId },
        });

        const ftsResult = await this.catalogSearch.searchRankedProductIds(
          tx,
          tenantId,
          {
            query: query.search,
            storeId: query.storeId,
            categoryId: query.categoryId,
            brandId: query.brandId,
            brandSlug: query.brandSlug,
            isPublished: query.isPublished,
            minPrice: query.minPrice,
            maxPrice: query.maxPrice,
            inStockOnly: query.inStockOnly,
            attributes: query.attributes,
            sortBy: query.sortBy,
            sortOrder: query.sortOrder as 'asc' | 'desc',
            take,
            skip,
          },
          definitions
        );

        total = ftsResult.total;

        if (total > 0 && ftsResult.items.length > 0) {
          const sortedIds = ftsResult.items.map(i => i.id);
          const dbItems = await tx.product.findMany({
            where: { id: { in: sortedIds } },
            include: {
              brand: true,
              images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
              variants: { include: { stockLevels: true } },
              categories: { include: { category: true } },
            },
          });
          const itemsMap = new Map(dbItems.map(item => [item.id, item]));
          // preserve exact ordering and tolerate missing rows due to concurrent deletion
          items = sortedIds.map(id => itemsMap.get(id)).filter(Boolean);
        }
      } else {
        const where: Prisma.ProductWhereInput = {};
        if (query?.storeId) {
          where.storeId = query.storeId;
        }
        if (query?.isPublished !== undefined) {
          where.isPublished = query.isPublished;
        }
        if (query?.categoryId) {
          where.categories = { some: { categoryId: query.categoryId } };
        }
        if (query?.brandId) {
          where.brandId = query.brandId;
        }
        if (query?.brandSlug) {
          where.brand = { slug: query.brandSlug };
        }

        const variantWhere: Prisma.ProductVariantWhereInput = {};
        if (query?.minPrice !== undefined || query?.maxPrice !== undefined) {
          variantWhere.price = {};
          if (query.minPrice !== undefined) variantWhere.price.gte = query.minPrice;
          if (query.maxPrice !== undefined) variantWhere.price.lte = query.maxPrice;
        }
        if (query?.inStockOnly) {
          variantWhere.stockLevels = {
            some: {
              quantityPhysical: { gt: 0 },
            },
          };
        }

        const definitions = await tx.attributeDefinition.findMany({
          where: { tenantId },
        });

        if (query?.attributes && Object.keys(query.attributes).length > 0) {
          const attrAndConditions = [];
          for (const [key, val] of Object.entries(query.attributes)) {
            const matchedDef = definitions.find((d) => {
              try {
                return normalizeAttributeKey(d.name) === key;
              } catch {
                return d.name.toLowerCase() === key;
              }
            });

            const keys = getCasingVariants(key, matchedDef?.name);
            attrAndConditions.push({
              OR: keys.map((k) => ({
                attributes: { path: [k], equals: val },
              })),
            });
          }
          variantWhere.AND = attrAndConditions;
        }

        if (Object.keys(variantWhere).length > 0) {
          where.variants = { some: variantWhere };
        }

        where.deletedAt = null;

        if (query?.sortBy === 'price_asc' || query?.sortBy === 'price_desc') {
          const matchedProducts = await tx.product.findMany({
            where,
            select: { id: true },
          });
          const productIds = matchedProducts.map((p) => p.id);
          total = productIds.length;

          if (productIds.length === 0) {
            items = [];
          } else {
            const sortDir = query.sortBy === 'price_asc' ? 'ASC' : 'DESC';
            const aggFunc = query.sortBy === 'price_asc' ? 'MIN' : 'MAX';

            const placeholders = productIds.map((_, index) => `$${index + 1}`).join(', ');
            const takeParamIndex = productIds.length + 1;
            const skipParamIndex = productIds.length + 2;

            const rawQuery = `
              SELECT p.id::text as id
              FROM products p
              LEFT JOIN product_variants pv ON p.id = pv.product_id
              WHERE p.id IN (${placeholders})
              GROUP BY p.id
              ORDER BY ${aggFunc}(pv.price) ${sortDir}
              LIMIT $${takeParamIndex} OFFSET $${skipParamIndex}
            `;

            const queryArgs = [...productIds, take, skip];
            const sortedRows = await tx.$queryRawUnsafe<Array<{ id: string }>>(rawQuery, ...queryArgs);
            const sortedIds = sortedRows.map((r) => r.id);

            const dbItems = await tx.product.findMany({
              where: { id: { in: sortedIds } },
              include: {
                brand: true,
                images: {
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                },
                variants: {
                  include: {
                    stockLevels: true,
                  },
                },
                categories: {
                  include: {
                    category: true,
                  },
                },
              },
            });

            const itemsMap = new Map(dbItems.map((item) => [item.id, item]));
            items = sortedIds.map((id) => itemsMap.get(id)).filter(Boolean);
          }
        } else {
          let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
          if (query?.sortBy === 'created_at' || query?.sortBy === 'createdAt') {
            orderBy = { createdAt: (query.sortOrder as Prisma.SortOrder) || 'desc' };
          } else if (query?.sortBy && query.sortBy !== 'title') {
            orderBy = { [query.sortBy]: (query.sortOrder as Prisma.SortOrder) || 'desc' };
          }

          const [dbItems, dbTotal] = await Promise.all([
            tx.product.findMany({
              where,
              include: {
                brand: true,
                images: {
                  orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                },
                variants: {
                  include: {
                    stockLevels: true,
                  },
                },
                categories: {
                  include: {
                    category: true,
                  },
                },
              },
              orderBy,
              take,
              skip,
            }),
            tx.product.count({ where }),
          ]);
          items = dbItems;
          total = dbTotal;
        }
      }

      const mappedItems = items.map((product: any) => {
        const mappedVariants = product.variants.map((v: any) => {
          const availableStock = Math.max(0, v.stockLevels?.reduce((sum: number, sl: any) => sum + (sl.quantityPhysical - sl.quantityReserved), 0) ?? 0);
          
          const rawAttrs = (v.attributes as Record<string, any>) || {};
          const normalizedAttrs: Record<string, any> = {};
          for (const [attrKey, attrVal] of Object.entries(rawAttrs)) {
            try {
              normalizedAttrs[normalizeAttributeKey(attrKey)] = attrVal;
            } catch {
              const safeKey = attrKey.trim().toLowerCase().replace(/\s+/g, '_');
              normalizedAttrs[safeKey] = attrVal;
            }
          }

          return {
            ...v,
            availableStock,
            attributes: normalizedAttrs,
          };
        });
        return {
          ...product,
          variants: mappedVariants,
        };
      });

      return new PaginatedResponseDto(mappedItems, total, query?.page || 1, query?.limit || 20);
    });

    await this.cache.set(cacheKey, result, 300);
    await this.cache.sadd(`tenant:${tenantId}:product-keys`, cacheKey);
    return result;
  }

  async findById(id: string) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || 'global';
    const cacheKey = `tenant:${tenantId}:product:${id}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const product = await this.db.exec(async (tx) => {
      return tx.product.findFirst({
        where: { id, deletedAt: null },
        include: {
          brand: true,
          images: {
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
          },
          variants: {
            include: {
              stockLevels: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
      });
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    const mappedVariants = product.variants.map((v) => {
      const availableStock = Math.max(0, v.stockLevels?.reduce((sum, sl) => sum + (sl.quantityPhysical - sl.quantityReserved), 0) ?? 0);
      
      const rawAttrs = (v.attributes as Record<string, any>) || {};
      const normalizedAttrs: Record<string, any> = {};
      for (const [key, value] of Object.entries(rawAttrs)) {
        try {
          normalizedAttrs[normalizeAttributeKey(key)] = value;
        } catch {
          const safeKey = key.trim().toLowerCase().replace(/\s+/g, '_');
          normalizedAttrs[safeKey] = value;
        }
      }

      return {
        ...v,
        availableStock,
        attributes: normalizedAttrs,
      };
    });

    const mappedProduct = {
      ...product,
      variants: mappedVariants,
    };

    await this.cache.set(cacheKey, mappedProduct, 300);
    await this.cache.sadd(`tenant:${tenantId}:product-keys`, cacheKey);
    return mappedProduct;
  }

  async create(data: {
    storeId?: string;
    brandId?: string;
    slug?: string;
    metaTitle?: string;
    metaDescription?: string;
    imageUrls?: string[];
    titleTranslations: any;
    descriptionTranslations?: any;
    attributes?: any;
    isPublished?: boolean;
    tenantId: string;
    categoryIds?: string[];
  }) {
    const categoryIds = data.categoryIds || [];
    const validatedAttributes = await this.attributeValidation.validateAttributes(
      data.tenantId,
      categoryIds,
      data.attributes,
      false, // isVariant = false
    );

    const result = await this.db.exec(async (tx) => {
      let storeId = data.storeId;
      const storeExists = storeId
        ? await tx.store.findFirst({
            where: { id: storeId, tenantId: data.tenantId },
          })
        : null;

      if (!storeExists) {
        const defaultStore = await tx.store.findFirst({
          where: { tenantId: data.tenantId }
        });
        if (!defaultStore) {
          const newStore = await tx.store.create({
            data: {
              tenantId: data.tenantId,
              name: 'Default Store',
              currency: 'IQD',
              languageDefault: 'ar',
            }
          });
          storeId = newStore.id;
        } else {
          storeId = defaultStore.id;
        }
      }

      if (data.brandId) {
        const brand = await tx.brand.findFirst({
          where: { id: data.brandId, tenantId: data.tenantId },
        });
        if (!brand) {
          throw new NotFoundException(`Brand with ID ${data.brandId} not found`);
        }
      }

      const product = await tx.product.create({
        data: {
          tenantId: data.tenantId,
          storeId: storeId!,
          brandId: data.brandId,
          slug: data.slug,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          titleTranslations: data.titleTranslations,
          descriptionTranslations: data.descriptionTranslations,
          attributes: validatedAttributes,
          isPublished: data.isPublished ?? false,
        },
      });

      if (data.imageUrls && data.imageUrls.length > 0) {
        for (let i = 0; i < data.imageUrls.length; i++) {
          await tx.productImage.create({
            data: {
              tenantId: data.tenantId,
              productId: product.id,
              url: data.imageUrls[i],
              isPrimary: i === 0,
              sortOrder: i,
            },
          });
        }
      }

      if (data.categoryIds && data.categoryIds.length > 0) {
        const validCategories = await tx.category.findMany({
          where: {
            id: { in: data.categoryIds },
            tenantId: data.tenantId,
          },
          select: { id: true },
        });

        const validIds = validCategories.map(c => c.id);
        const invalidIds = data.categoryIds.filter(id => !validIds.includes(id));
        if (invalidIds.length > 0) {
          throw new NotFoundException(`Categories not found or unauthorized: ${invalidIds.join(', ')}`);
        }

        await tx.categoriesOnProducts.createMany({
          data: data.categoryIds.map(categoryId => ({
            tenantId: data.tenantId,
            productId: product.id,
            categoryId,
          })),
        });
      }

      // Refresh FTS vector inside the transaction — failure rolls back the entire create.
      await this.searchIndex.refreshProductVector(tx, data.tenantId, product.id);

      return product;
    });

    await this.cache.invalidateKeys(`tenant:${data.tenantId}:product-keys`);
    return result;
  }

  async update(
    id: string,
    data: {
      brandId?: string;
      slug?: string;
      metaTitle?: string;
      metaDescription?: string;
      imageUrls?: string[];
      titleTranslations?: any;
      descriptionTranslations?: any;
      attributes?: any;
      isPublished?: boolean;
      categoryIds?: string[];
    }
  ) {
    const product = await this.findById(id);

    const finalCategoryIds = data.categoryIds !== undefined
      ? data.categoryIds
      : (product.categories || []).map((c: any) => c.categoryId);

    let validatedAttributes = data.attributes;
    if (data.attributes !== undefined || data.categoryIds !== undefined) {
      const attrsToValidate = data.attributes !== undefined ? data.attributes : (product.attributes as Record<string, any> || {});
      validatedAttributes = await this.attributeValidation.validateAttributes(
        product.tenantId,
        finalCategoryIds,
        attrsToValidate,
        false, // isVariant = false
      );
    }

    const result = await this.db.exec(async (tx) => {
      if (data.brandId) {
        const brand = await tx.brand.findFirst({
          where: { id: data.brandId, tenantId: product.tenantId },
        });
        if (!brand) {
          throw new NotFoundException(`Brand with ID ${data.brandId} not found`);
        }
      }

      if (data.categoryIds && data.categoryIds.length > 0) {
        const validCategories = await tx.category.findMany({
          where: {
            id: { in: data.categoryIds },
            tenantId: product.tenantId,
          },
          select: { id: true },
        });

        const validIds = validCategories.map(c => c.id);
        const invalidIds = data.categoryIds.filter(id => !validIds.includes(id));
        if (invalidIds.length > 0) {
          throw new NotFoundException(`Categories not found or unauthorized: ${invalidIds.join(', ')}`);
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          brandId: data.brandId,
          slug: data.slug,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          titleTranslations: data.titleTranslations,
          descriptionTranslations: data.descriptionTranslations,
          attributes: validatedAttributes,
          isPublished: data.isPublished,
        },
      });

      if (data.categoryIds !== undefined) {
        await tx.categoriesOnProducts.deleteMany({ where: { productId: id } });
        if (data.categoryIds.length > 0) {
          await tx.categoriesOnProducts.createMany({
            data: data.categoryIds.map(categoryId => ({
              tenantId: product.tenantId,
              productId: id,
              categoryId,
            })),
          });
        }
      }

      if (data.imageUrls && data.imageUrls.length > 0) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        for (let i = 0; i < data.imageUrls.length; i++) {
          await tx.productImage.create({
            data: {
              tenantId: product.tenantId,
              productId: id,
              url: data.imageUrls[i],
              isPrimary: i === 0,
              sortOrder: i,
            },
          });
        }
      }

      // Refresh FTS vector only when search-relevant fields changed.
      // isPublished, categoryIds, imageUrls do not affect the tsvector.
      const needsVectorRefresh =
        data.titleTranslations !== undefined ||
        data.descriptionTranslations !== undefined ||
        data.slug !== undefined ||
        data.brandId !== undefined;

      if (needsVectorRefresh) {
        await this.searchIndex.refreshProductVector(tx, product.tenantId, id);
      }

      return updated;
    });

    await this.cache.invalidateKeys(`tenant:${product.tenantId}:product-keys`);
    return result;
  }

  async getProductImages(productId: string, tenantIdOverride?: string) {
    const tenantId = tenantIdOverride || this.getTenantId();
    await this.findById(productId);

    return this.db.exec(async (tx) => {
      return tx.productImage.findMany({
        where: { productId, tenantId },
        orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
      });
    });
  }

  async addProductImage(
    productId: string,
    data: {
      url: string;
      altText?: string;
      isPrimary?: boolean;
      variantId?: string;
      sortOrder?: number;
    },
    tenantIdOverride?: string
  ) {
    const tenantId = tenantIdOverride || this.getTenantId();
    const product = await this.findById(productId);

    const result = await this.db.exec(async (tx) => {
      if (data.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId, tenantId },
          data: { isPrimary: false },
        });
      }

      const existingCount = await tx.productImage.count({
        where: { productId, tenantId },
      });

      const isPrimary = data.isPrimary ?? (existingCount === 0);

      return tx.productImage.create({
        data: {
          tenantId,
          productId,
          variantId: data.variantId,
          url: data.url,
          altText: data.altText,
          isPrimary,
          sortOrder: data.sortOrder ?? existingCount,
        },
      });
    });

    await this.cache.invalidateKeys(`tenant:${tenantId}:product-keys`);
    return result;
  }

  async deleteProductImage(productId: string, imageId: string, tenantIdOverride?: string) {
    const tenantId = tenantIdOverride || this.getTenantId();
    await this.findById(productId);

    const result = await this.db.exec(async (tx) => {
      const image = await tx.productImage.findFirst({
        where: { id: imageId, productId, tenantId },
      });
      if (!image) {
        throw new NotFoundException(`Image ${imageId} not found under product ${productId}`);
      }

      await tx.productImage.delete({
        where: { id: imageId },
      });

      if (image.isPrimary) {
        const nextImage = await tx.productImage.findFirst({
          where: { productId, tenantId },
          orderBy: { sortOrder: 'asc' },
        });
        if (nextImage) {
          await tx.productImage.update({
            where: { id: nextImage.id },
            data: { isPrimary: true },
          });
        }
      }

      return { success: true, deletedId: imageId };
    });

    await this.cache.invalidateKeys(`tenant:${tenantId}:product-keys`);
    return result;
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    data: {
      variantId?: string | null;
      isPrimary?: boolean;
      sortOrder?: number;
      altText?: string;
    },
    tenantIdOverride?: string
  ) {
    const tenantId = tenantIdOverride || this.getTenantId();
    await this.findById(productId);

    const result = await this.db.exec(async (tx) => {
      const image = await tx.productImage.findFirst({
        where: { id: imageId, productId, tenantId },
      });
      if (!image) {
        throw new NotFoundException(`Image ${imageId} not found under product ${productId}`);
      }

      if (data.isPrimary) {
        await tx.productImage.updateMany({
          where: { productId, tenantId },
          data: { isPrimary: false },
        });
      }

      return tx.productImage.update({
        where: { id: imageId },
        data: {
          variantId: data.variantId === null ? null : data.variantId,
          isPrimary: data.isPrimary,
          sortOrder: data.sortOrder,
          altText: data.altText,
        },
      });
    });

    await this.cache.invalidateKeys(`tenant:${tenantId}:product-keys`);
    return result;
  }

  async softDelete(id: string) {
    const product = await this.findById(id);
    const result = await this.db.exec(async (tx) => {
      return tx.product.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });
    });

    await this.cache.invalidateKeys(`tenant:${product.tenantId}:product-keys`);
    return result;
  }

  // Variant CRUD and Variant Matrix Generation

  async createVariant(
    productId: string,
    data: {
      sku: string;
      barcode?: string;
      price: number;
      costPrice?: number;
      priceOverride?: number;
      compareAtPrice?: number;
      weight?: number;
      variantName?: string;
      isActive?: boolean;
      position?: number;
      dimensions?: Record<string, any>;
      attributes?: Record<string, any>;
      tenantId: string;
    }
  ) {
    const product = await this.findById(productId);
    const categoryIds = (product.categories || []).map((c: any) => c.categoryId);
    const validatedAttributes = await this.attributeValidation.validateAttributes(
      data.tenantId,
      categoryIds,
      data.attributes,
      true, // isVariant = true
    );

    const result = await this.db.exec(async (tx) => {
      // Check SKU uniqueness per tenant
      const existingSku = await tx.productVariant.findFirst({
        where: { sku: data.sku, tenantId: data.tenantId },
      });
      if (existingSku) {
        throw new BadRequestException(`SKU ${data.sku} is already taken`);
      }

      if (data.barcode) {
        const existingBarcode = await tx.productVariant.findFirst({
          where: { barcode: data.barcode, tenantId: data.tenantId },
        });
        if (existingBarcode) {
          throw new BadRequestException(`Barcode ${data.barcode} is already taken`);
        }
      }

      const variant = await tx.productVariant.create({
        data: {
          tenantId: data.tenantId,
          productId,
          sku: data.sku,
          barcode: data.barcode,
          price: data.price,
          costPrice: data.costPrice,
          priceOverride: data.priceOverride,
          compareAtPrice: data.compareAtPrice,
          weight: data.weight,
          variantName: data.variantName,
          isActive: data.isActive ?? true,
          position: data.position ?? 0,
          dimensions: data.dimensions ? (data.dimensions as any) : undefined,
          attributes: validatedAttributes ? (validatedAttributes as any) : undefined,
        },
      });

      // Refresh FTS vector after variant creation — new SKU must be indexed.
      await this.searchIndex.refreshProductVector(tx, data.tenantId, productId);

      return variant;
    });

    await this.cache.invalidateKeys(`tenant:${product.tenantId}:product-keys`);
    return result;
  }

  async updateVariant(
    productId: string,
    variantId: string,
    data: {
      sku?: string;
      barcode?: string;
      price?: number;
      costPrice?: number;
      priceOverride?: number;
      compareAtPrice?: number;
      weight?: number;
      variantName?: string;
      isActive?: boolean;
      position?: number;
      dimensions?: Record<string, any>;
      attributes?: Record<string, any>;
      tenantId: string;
    }
  ) {
    const product = await this.findById(productId);
    let validatedAttributes: Record<string, any> | undefined = undefined;
    if (data.attributes !== undefined) {
      const categoryIds = (product.categories || []).map((c: any) => c.categoryId);
      validatedAttributes = await this.attributeValidation.validateAttributes(
        data.tenantId,
        categoryIds,
        data.attributes,
        true, // isVariant = true
      );
    }

    const result = await this.db.exec(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId, tenantId: data.tenantId },
      });
      if (!variant) {
        throw new NotFoundException(`Variant with ID ${variantId} not found under product ${productId}`);
      }

      if (data.sku && data.sku !== variant.sku) {
        const existingSku = await tx.productVariant.findFirst({
          where: { sku: data.sku, tenantId: data.tenantId },
        });
        if (existingSku) {
          throw new BadRequestException(`SKU ${data.sku} is already taken`);
        }
      }

      if (data.barcode && data.barcode !== variant.barcode) {
        const existingBarcode = await tx.productVariant.findFirst({
          where: { barcode: data.barcode, tenantId: data.tenantId },
        });
        if (existingBarcode) {
          throw new BadRequestException(`Barcode ${data.barcode} is already taken`);
        }
      }

      const updated = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          sku: data.sku,
          barcode: data.barcode,
          price: data.price,
          costPrice: data.costPrice,
          priceOverride: data.priceOverride,
          compareAtPrice: data.compareAtPrice,
          weight: data.weight,
          variantName: data.variantName,
          isActive: data.isActive,
          position: data.position,
          dimensions: data.dimensions !== undefined ? (data.dimensions as any) : undefined,
          attributes: validatedAttributes !== undefined ? (validatedAttributes as any) : undefined,
        },
      });

      // Refresh FTS vector only when SKU or isActive changed.
      // Price, weight, cost, barcode, position, dimensions do not affect tsvector.
      const needsVectorRefresh =
        data.sku !== undefined ||
        data.isActive !== undefined;

      if (needsVectorRefresh) {
        await this.searchIndex.refreshProductVector(tx, data.tenantId, productId);
      }

      return updated;
    });

    await this.cache.invalidateKeys(`tenant:${product.tenantId}:product-keys`);
    return result;
  }

  async deleteVariant(productId: string, variantId: string, tenantId: string) {
    const product = await this.findById(productId);

    const result = await this.db.exec(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId, tenantId },
      });
      if (!variant) {
        throw new NotFoundException(`Variant with ID ${variantId} not found under product ${productId}`);
      }

      const deleted = await tx.productVariant.delete({
        where: { id: variantId },
      });

      // Refresh FTS vector after hard delete — removed SKU must be cleared from index.
      await this.searchIndex.refreshProductVector(tx, tenantId, productId);

      return deleted;
    });

    await this.cache.invalidateKeys(`tenant:${product.tenantId}:product-keys`);
    return result;
  }

  async generateVariantMatrix(
    productId: string,
    data: {
      baseSku: string;
      basePrice: number;
      options: Record<string, string[]>;
      tenantId: string;
    }
  ) {
    const product = await this.findById(productId);
    const categoryIds = (product.categories || []).map((c: any) => c.categoryId);
    const normalizedOptions = await this.attributeValidation.validateMatrixOptions(
      data.tenantId,
      categoryIds,
      data.options,
    );

    const optionKeys = Object.keys(normalizedOptions);
    const optionValues = Object.values(normalizedOptions);
    if (optionValues.length === 0) {
      throw new BadRequestException('No options provided for variant matrix generation');
    }

    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce((acc, curr) => {
        return acc.flatMap(d => curr.map(e => [...d, e]));
      }, [[]] as string[][]);
    };

    const combinations = cartesian(optionValues);

    const result = await this.db.exec(async (tx) => {
      const createdVariants = [];

      for (const combo of combinations) {
        const suffix = combo.join('-');
        const variantSku = `${data.baseSku}-${suffix}`;

        const existingVariant = await tx.productVariant.findFirst({
          where: { sku: variantSku, tenantId: data.tenantId },
        });

        if (existingVariant) {
          continue;
        }

        const attributes: Record<string, string> = {};
        optionKeys.forEach((key, index) => {
          attributes[key] = combo[index];
        });

        const variantName = combo.join(' / ');

        const variant = await tx.productVariant.create({
          data: {
            tenantId: data.tenantId,
            productId,
            sku: variantSku,
            price: data.basePrice,
            variantName,
            attributes,
          },
        });
        createdVariants.push(variant);
      }

      // Refresh the FTS vector exactly once after all variants are created.
      // Do not refresh per-variant — one call aggregates all SKUs atomically.
      // If no new variants were created (all SKUs already exist), still refresh
      // to ensure the vector is consistent with current state.
      await this.searchIndex.refreshProductVector(tx, data.tenantId, productId);

      return createdVariants;
    });

    await this.cache.invalidateKeys(`tenant:${product.tenantId}:product-keys`);
    return result;
  }
}
