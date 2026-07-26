import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { AttributeValidationService } from './attribute-definitions/attribute-validation.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    private readonly attributeValidation: AttributeValidationService,
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
      const where: Prisma.ProductWhereInput = {};
      if (query?.storeId) {
        where.storeId = query.storeId;
      }
      if (query?.isPublished !== undefined) {
        where.isPublished = query.isPublished;
      }
      if (query?.search) {
        const s = query.search.trim();
        where.OR = [
          { titleTranslations: { path: ['ar'], string_contains: s } },
          { titleTranslations: { path: ['en'], string_contains: s } },
          { descriptionTranslations: { path: ['ar'], string_contains: s } },
          { descriptionTranslations: { path: ['en'], string_contains: s } },
          { slug: { contains: s, mode: 'insensitive' } },
          { brand: { name: { contains: s, mode: 'insensitive' } } },
          { variants: { some: { sku: { contains: s, mode: 'insensitive' } } } },
        ];
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
      if (query?.attributes && Object.keys(query.attributes).length > 0) {
        const attrConditions = Object.entries(query.attributes).map(([key, val]) => ({
          attributes: { path: [key], equals: val },
        }));
        variantWhere.AND = attrConditions;
      }

      if (Object.keys(variantWhere).length > 0) {
        where.variants = { some: variantWhere };
      }

      where.deletedAt = null;

      const take = query?.take || 20;
      const skip = query?.skip || 0;
      let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
      if (query?.sortBy === 'created_at' || query?.sortBy === 'createdAt') {
        orderBy = { createdAt: (query.sortOrder as Prisma.SortOrder) || 'desc' };
      } else if (query?.sortBy && query.sortBy !== 'price_asc' && query.sortBy !== 'price_desc' && query.sortBy !== 'title') {
        orderBy = { [query.sortBy]: (query.sortOrder as Prisma.SortOrder) || 'desc' };
      }

      const [items, total] = await Promise.all([
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

      const mappedItems = items.map((product) => {
        const mappedVariants = product.variants.map((v) => {
          const availableStock = Math.max(0, v.stockLevels?.reduce((sum, sl) => sum + (sl.quantityPhysical - sl.quantityReserved), 0) ?? 0);
          return {
            ...v,
            availableStock,
          };
        });
        return {
          ...product,
          variants: mappedVariants,
        };
      });

      let finalItems = mappedItems;
      if (query?.sortBy === 'price_asc') {
        finalItems = [...mappedItems].sort((a, b) => {
          const minA = Math.min(...a.variants.map((v) => Number(v.price) || 0));
          const minB = Math.min(...b.variants.map((v) => Number(v.price) || 0));
          return minA - minB;
        });
      } else if (query?.sortBy === 'price_desc') {
        finalItems = [...mappedItems].sort((a, b) => {
          const maxA = Math.max(...a.variants.map((v) => Number(v.price) || 0));
          const maxB = Math.max(...b.variants.map((v) => Number(v.price) || 0));
          return maxB - maxA;
        });
      }

      return new PaginatedResponseDto(finalItems, total, query?.page || 1, query?.limit || 20);
    });

    await this.cache.set(cacheKey, result, 300);
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
      return {
        ...v,
        availableStock,
      };
    });

    const mappedProduct = {
      ...product,
      variants: mappedVariants,
    };

    await this.cache.set(cacheKey, mappedProduct, 300);
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
          attributes: data.attributes,
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

      return product;
    });

    await this.cache.invalidatePattern(`tenant:${data.tenantId}:product`);
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
    }
  ) {
    const product = await this.findById(id);
    const result = await this.db.exec(async (tx) => {
      if (data.brandId) {
        const brand = await tx.brand.findFirst({
          where: { id: data.brandId, tenantId: product.tenantId },
        });
        if (!brand) {
          throw new NotFoundException(`Brand with ID ${data.brandId} not found`);
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
          attributes: data.attributes,
          isPublished: data.isPublished,
        },
      });

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

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
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

    await this.cache.invalidatePattern(`tenant:${tenantId}:product`);
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

    await this.cache.invalidatePattern(`tenant:${tenantId}:product`);
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

    await this.cache.invalidatePattern(`tenant:${tenantId}:product`);
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

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
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

      return tx.productVariant.create({
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
    });

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
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

      return tx.productVariant.update({
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
    });

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
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

      return tx.productVariant.delete({
        where: { id: variantId },
      });
    });

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
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

      return createdVariants;
    });

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
    return result;
  }
}
