import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService
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
        where.OR = [
          { variants: { some: { sku: { contains: query.search, mode: 'insensitive' } } } },
        ];
      }
      if (query?.categoryId) {
        where.categories = { some: { categoryId: query.categoryId } };
      }
      where.deletedAt = null;

      const take = query?.take || 20;
      const skip = query?.skip || 0;
      const orderBy: Prisma.ProductOrderByWithRelationInput = query?.sortBy ? { [query.sortBy]: query.sortOrder || 'desc' } : { createdAt: 'desc' };

      const [items, total] = await Promise.all([
        tx.product.findMany({
          where,
          include: {
            brand: true,
            images: {
              orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
            },
            variants: true,
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

      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
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
          variants: true,
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

    await this.cache.set(cacheKey, product, 300);
    return product;
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
      weight?: number;
      tenantId: string;
    }
  ) {
    const product = await this.findById(productId);

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
          weight: data.weight,
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
      weight?: number;
      tenantId: string;
    }
  ) {
    const product = await this.findById(productId);

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
          weight: data.weight,
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

    const optionValues = Object.values(data.options);
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

        const variant = await tx.productVariant.create({
          data: {
            tenantId: data.tenantId,
            productId,
            sku: variantSku,
            price: data.basePrice,
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
