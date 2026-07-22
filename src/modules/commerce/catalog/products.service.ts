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

      const product = await tx.product.create({
        data: {
          tenantId: data.tenantId,
          storeId: storeId!,
          titleTranslations: data.titleTranslations,
          descriptionTranslations: data.descriptionTranslations,
          attributes: data.attributes,
          isPublished: data.isPublished ?? false,
        },
      });

      if (data.categoryIds && data.categoryIds.length > 0) {
        // Validate categories exist and belong to this tenant
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
      titleTranslations?: any;
      descriptionTranslations?: any;
      attributes?: any;
      isPublished?: boolean;
    }
  ) {
    const product = await this.findById(id);
    const result = await this.db.exec(async (tx) => {
      return tx.product.update({
        where: { id },
        data,
      });
    });

    await this.cache.invalidatePattern(`tenant:${product.tenantId}:product`);
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
