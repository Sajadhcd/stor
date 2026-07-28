import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { NotFoundException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';
import { SortOrder } from '../../../common/dto/pagination-query.dto.js';
import { AttributeValidationService } from './attribute-definitions/attribute-validation.service.js';
import { CatalogSearchRepository } from './repositories/catalog-search.repository.js';
import { ProductSearchIndexRepository } from '../search/repositories/product-search-index.repository.js';

interface MockProduct {
  id: string;
  tenantId: string;
  storeId: string;
  titleTranslations: Prisma.JsonValue;
  descriptionTranslations?: Prisma.JsonValue;
  attributes?: Prisma.JsonValue;
  isPublished: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  variants?: MockProductVariant[];
  categories?: { category: MockCategory }[];
}

interface MockProductVariant {
  id: string;
  tenantId: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  price: number;
  costPrice?: number | null;
  weight?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MockStore {
  id: string;
  tenantId: string;
  name: string;
  currency: string;
  languageDefault: string;
}

interface MockCategory {
  id: string;
  tenantId: string;
  name: string;
}

const createMockProduct = (overrides?: Partial<MockProduct>): MockProduct => ({
  id: 'prod-123',
  tenantId: 'tenant-123',
  storeId: 'store-123',
  titleTranslations: { en: 'Test Product', ar: 'منتج تجريبي' },
  descriptionTranslations: { en: 'Test Description' },
  attributes: { color: 'red' },
  isPublished: true,
  deletedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  variants: [],
  categories: [],
  ...overrides,
});

const createMockStore = (overrides?: Partial<MockStore>): MockStore => ({
  id: 'store-123',
  tenantId: 'tenant-123',
  name: 'Test Store',
  currency: 'IQD',
  languageDefault: 'ar',
  ...overrides,
});

const createMockCategory = (overrides?: Partial<MockCategory>): MockCategory => ({
  id: 'cat-1',
  tenantId: 'tenant-123',
  name: 'Electronics',
  ...overrides,
});

const createMockVariant = (overrides?: Partial<MockProductVariant>): MockProductVariant => ({
  id: 'var-123',
  tenantId: 'tenant-123',
  productId: 'prod-123',
  sku: 'TEST-SKU-1',
  barcode: '1234567890',
  price: 150,
  costPrice: 100,
  weight: 0.5,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

type TxCallback<T> = (tx: MockPrismaTx) => Promise<T>;

interface MockPrismaTx {
  $queryRawUnsafe: jest.Mock;
  $executeRaw: jest.Mock;
  [key: string]: any; // allows test-only property assignment (brand, productImage, etc.)
  product: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  store: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  category: {
    findMany: jest.Mock;
  };
  categoriesOnProducts: {
    createMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  productVariant: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  attributeDefinition: {
    findMany: jest.Mock;
  };
}

describe('ProductsService', () => {
  let service: ProductsService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockTx: MockPrismaTx;
  let mockTenantPrismaService: { exec: jest.Mock };
  let mockCatalogSearch: { searchRankedProductIds: jest.Mock };
  let mockSearchIndex: { refreshProductVector: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
      sadd: jest.fn().mockResolvedValue(1),
      invalidateKeys: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    const defaultProduct = createMockProduct();
    const defaultStore = createMockStore();
    const defaultCategory = createMockCategory();
    const defaultVariant = createMockVariant();

    mockTx = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      product: {
        findMany: jest.fn().mockResolvedValue([defaultProduct]),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn().mockResolvedValue(defaultProduct),
        create: jest.fn().mockResolvedValue(defaultProduct),
        update: jest.fn().mockResolvedValue(defaultProduct),
      },
      store: {
        findFirst: jest.fn().mockResolvedValue(defaultStore),
        create: jest.fn().mockResolvedValue(defaultStore),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([{ id: defaultCategory.id }]),
      },
      categoriesOnProducts: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args: { data: Partial<MockProductVariant> }) =>
          Promise.resolve(createMockVariant(args.data)),
        ),
        update: jest.fn().mockImplementation((args: { data: Partial<MockProductVariant> }) =>
          Promise.resolve(createMockVariant(args.data)),
        ),
        delete: jest.fn().mockResolvedValue(defaultVariant),
      },
      attributeDefinition: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const mockAttributeValidation = {
      validateAttributes: jest.fn().mockImplementation((tenantId, catIds, attrs, isVariant) => Promise.resolve(attrs)),
      validateMatrixOptions: jest.fn().mockImplementation((tenantId, catIds, options) => Promise.resolve(options)),
    };

    mockCatalogSearch = {
      searchRankedProductIds: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    mockSearchIndex = {
      refreshProductVector: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: AttributeValidationService, useValue: mockAttributeValidation },
        { provide: CatalogSearchRepository, useValue: mockCatalogSearch },
        { provide: ProductSearchIndexRepository, useValue: mockSearchIndex },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return cached response on cache hit without querying database', async () => {
      const cachedData = {
        data: [createMockProduct()],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockCacheService.get.mockResolvedValueOnce(cachedData);

      const result = await service.findAll({ page: 1, limit: 20, skip: 0, take: 20 });

      expect(result).toEqual(cachedData);
      expect(mockTenantPrismaService.exec).not.toHaveBeenCalled();
    });

    it('should query database, populate cache, and return paginated data on cache miss', async () => {
      const product = createMockProduct();
      mockTx.product.findMany.mockResolvedValueOnce([product]);
      mockTx.product.count.mockResolvedValueOnce(1);

      const result = await service.findAll({ storeId: 'store-123', page: 1, limit: 20, skip: 0, take: 20 });

      expect(result.data).toEqual([product]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('tenant:global:products:'),
        result,
        300,
      );
    });

    it('should filter products by storeId, isPublished, search, categoryId, and soft-delete status using FTS', async () => {
      mockCatalogSearch.searchRankedProductIds.mockResolvedValueOnce({ items: [{ id: '1', score: 0.9 }], total: 1 });

      mockTx.product.findMany.mockResolvedValueOnce([{ id: '1', variants: [] }]);

      await service.findAll({
        storeId: 'store-123',
        isPublished: true,
        search: 'SKU-001',
        categoryId: 'cat-1',
        skip: 0,
        take: 20,
      });

      expect(mockCatalogSearch.searchRankedProductIds).toHaveBeenCalledWith(
        mockTx,
        'global',
        expect.objectContaining({
          storeId: 'store-123',
          isPublished: true,
          query: 'SKU-001',
          categoryId: 'cat-1',
          skip: 0,
          take: 20,
        }),
        expect.any(Array)
      );

      expect(mockTx.product.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['1'] } },
        include: expect.any(Object),
      });
    });

    it('should apply custom pagination parameters (skip, take, page, limit, totalPages)', async () => {
      mockTx.product.findMany.mockResolvedValueOnce([createMockProduct({ id: 'prod-2' })]);
      mockTx.product.count.mockResolvedValueOnce(25);

      const result = await service.findAll({ page: 2, limit: 10, skip: 10, take: 10 });

      expect(result.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
      expect(mockTx.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });

    it('should handle sorting parameters (sortBy, sortOrder)', async () => {
      await service.findAll({ sortBy: 'price', sortOrder: SortOrder.ASC, skip: 0, take: 20 });

      expect(mockTx.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { price: 'asc' },
        }),
      );
    });

    it('should handle price_asc using database ordering via variant min price', async () => {
      mockTx.product.findMany.mockResolvedValueOnce([{ id: 'prod-123' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'prod-123' }]);
      mockTx.product.findMany.mockResolvedValueOnce([createMockProduct({ id: 'prod-123' })]);

      await service.findAll({ sortBy: 'price_asc', skip: 0, take: 20 });

      expect(mockTx.product.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          select: { id: true },
        }),
      );

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('MIN(pv.price) ASC'),
        expect.any(String),
        20,
        0,
      );

      expect(mockTx.product.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: { id: { in: ['prod-123'] } },
        }),
      );
    });

    it('should handle price_desc using database ordering via variant max price', async () => {
      mockTx.product.findMany.mockResolvedValueOnce([{ id: 'prod-123' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'prod-123' }]);
      mockTx.product.findMany.mockResolvedValueOnce([createMockProduct({ id: 'prod-123' })]);

      await service.findAll({ sortBy: 'price_desc', skip: 0, take: 20 });

      expect(mockTx.product.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          select: { id: true },
        }),
      );

      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('MAX(pv.price) DESC'),
        expect.any(String),
        20,
        0,
      );
    });

    it('should not perform post-pagination sorting in memory', async () => {
      const productA = createMockProduct({
        id: 'prod-A',
        variants: [createMockVariant({ id: 'var-A', price: 100 })],
      });
      const productB = createMockProduct({
        id: 'prod-B',
        variants: [createMockVariant({ id: 'var-B', price: 50 })],
      });

      mockTx.product.findMany.mockResolvedValueOnce([{ id: 'prod-A' }, { id: 'prod-B' }]);
      mockTx.$queryRawUnsafe.mockResolvedValueOnce([{ id: 'prod-A' }, { id: 'prod-B' }]);
      mockTx.product.findMany.mockResolvedValueOnce([productA, productB]);

      const result = await service.findAll({ sortBy: 'price_asc', skip: 0, take: 2 });

      expect(result.data[0].id).toBe('prod-A');
      expect(result.data[1].id).toBe('prod-B');
    });

    it('should use tenantId from requestContextStorage for cache key scoping', async () => {
      await requestContextStorage.run({ tenantId: 'tenant-456', requestId: 'r1', correlationId: 'c1' }, async () => {
        await service.findAll({ page: 1, skip: 0, take: 20 });
        expect(mockCacheService.get).toHaveBeenCalledWith(
          expect.stringContaining('tenant:tenant-456:products:'),
        );
      });
    });

    it('should filter variants using normalized keys and case-insensitive casing variants', async () => {
      mockTx.attributeDefinition.findMany.mockResolvedValueOnce([{ name: 'Color' }]);
      await service.findAll({
        attributes: { color: 'red' },
        skip: 0,
        take: 20,
      });

      expect(mockTx.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            variants: {
              some: {
                AND: [
                  {
                    OR: [
                      { attributes: { path: ['color'], equals: 'red' } },
                      { attributes: { path: ['COLOR'], equals: 'red' } },
                      { attributes: { path: ['Color'], equals: 'red' } },
                    ],
                  },
                ],
              },
            },
            deletedAt: null,
          },
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return cached product on cache hit without executing database transaction', async () => {
      const product = createMockProduct();
      mockCacheService.get.mockResolvedValueOnce(product);

      const result = await service.findById('prod-123');

      expect(result).toEqual(product);
      expect(mockTenantPrismaService.exec).not.toHaveBeenCalled();
    });

    it('should query database, populate cache, and return product on cache miss', async () => {
      const product = createMockProduct();
      mockTx.product.findFirst.mockResolvedValueOnce(product);

      const result = await service.findById('prod-123');

      expect(result).toEqual(product);
      expect(mockTx.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'prod-123', deletedAt: null },
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
          categories: { include: { category: true } },
        },
      });
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'tenant:global:product:prod-123',
        product,
        300,
      );
    });

    it('should throw NotFoundException when product does not exist or is soft-deleted', async () => {
      mockTx.product.findFirst.mockResolvedValueOnce(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should normalize returned legacy attribute keys on variants', async () => {
      const product = createMockProduct({
        variants: [
          {
            id: 'var-1',
            tenantId: 'tenant-123',
            productId: 'prod-123',
            sku: 'SKU-LEGACY',
            price: 100,
            attributes: {
              Color: 'Red',
              SIZE: 'M',
              'Storage Space': '64GB',
            } as any,
          } as any,
        ],
      });
      mockTx.product.findFirst.mockResolvedValueOnce(product);

      const result = await service.findById('prod-123');

      expect(result.variants[0].attributes).toEqual({
        color: 'Red',
        size: 'M',
        storage_space: '64GB',
      });
    });
  });

  describe('create', () => {
    it('should create product, link categories, and invalidate tenant cache', async () => {
      const product = createMockProduct({
        attributes: { material: 'Cotton' },
      });
      mockTx.product.create.mockResolvedValueOnce(product);
      mockTx.category.findMany.mockResolvedValueOnce([{ id: 'cat-1' }]);

      const result = await service.create({
        storeId: 'store-123',
        titleTranslations: { en: 'New Product' },
        tenantId: 'tenant-123',
        categoryIds: ['cat-1'],
        attributes: { material: 'Cotton' },
      });

      expect(result).toEqual(product);
      expect(mockTx.categoriesOnProducts.createMany).toHaveBeenCalledWith({
        data: [{ tenantId: 'tenant-123', productId: product.id, categoryId: 'cat-1' }],
      });
      expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
    });

    it('should use default store when provided storeId is not found for tenant', async () => {
      mockTx.store.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(createMockStore({ id: 'default-store-id' }));

      await service.create({
        storeId: 'missing-store',
        titleTranslations: { en: 'Product' },
        tenantId: 'tenant-123',
      });

      expect(mockTx.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ storeId: 'default-store-id' }),
        }),
      );
    });

    it('should automatically create default store if tenant has no stores', async () => {
      mockTx.store.findFirst.mockResolvedValue(null);
      mockTx.store.create.mockResolvedValueOnce(createMockStore({ id: 'newly-created-store' }));

      await service.create({
        storeId: 'non-existent',
        titleTranslations: { en: 'Product' },
        tenantId: 'tenant-123',
      });

      expect(mockTx.store.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-123',
          name: 'Default Store',
          currency: 'IQD',
          languageDefault: 'ar',
        },
      });
    });

    it('should throw NotFoundException if categoryIds contain invalid or cross-tenant IDs', async () => {
      mockTx.category.findMany.mockResolvedValueOnce([]);

      await expect(
        service.create({
          storeId: 'store-123',
          titleTranslations: { en: 'Product' },
          tenantId: 'tenant-123',
          categoryIds: ['unauthorized-cat'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update product details and invalidate tenant cache', async () => {
      const product = createMockProduct();
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      mockTx.product.update.mockResolvedValueOnce({ ...product, isPublished: true });

      const result = await service.update('prod-123', { isPublished: true });

      expect(result.isPublished).toBe(true);
      expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
    });

    it('should throw NotFoundException if product to update does not exist', async () => {
      mockTx.product.findFirst.mockResolvedValueOnce(null);

      await expect(service.update('invalid-id', { isPublished: true })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update categories, delete old ones, validate attributes, and save changes', async () => {
      const product = createMockProduct({
        id: 'prod-123',
        tenantId: 'tenant-123',
        categories: [{ categoryId: 'cat-old' }] as any,
      });
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      mockTx.product.update.mockResolvedValueOnce({ ...product, attributes: { material: 'Wool' } });
      mockTx.category.findMany.mockResolvedValueOnce([{ id: 'cat-new' }]);

      const result = await service.update('prod-123', {
        categoryIds: ['cat-new'],
        attributes: { material: 'Wool' },
      });

      expect(mockTx.categoriesOnProducts.deleteMany).toHaveBeenCalledWith({
        where: { productId: 'prod-123' },
      });
      expect(mockTx.categoriesOnProducts.createMany).toHaveBeenCalledWith({
        data: [{ tenantId: 'tenant-123', productId: 'prod-123', categoryId: 'cat-new' }],
      });
      expect(mockTx.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'prod-123' },
          data: expect.objectContaining({
            attributes: { material: 'Wool' },
          }),
        }),
      );
    });

    it('should throw NotFoundException in update if categoryIds contain invalid or cross-tenant IDs', async () => {
      const product = createMockProduct({ id: 'prod-123', tenantId: 'tenant-123' });
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      mockTx.category.findMany.mockResolvedValueOnce([]);

      await expect(
        service.update('prod-123', {
          categoryIds: ['unauthorized-cat'],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should query categories strictly scoped to the tenant to maintain tenant isolation', async () => {
      const product = createMockProduct({ id: 'prod-123', tenantId: 'tenant-123' });
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      mockTx.category.findMany.mockResolvedValueOnce([{ id: 'cat-1' }]);

      await service.update('prod-123', {
        categoryIds: ['cat-1'],
      });

      expect(mockTx.category.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-123',
          }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('should set deletedAt timestamp and invalidate tenant cache', async () => {
      const product = createMockProduct();
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      mockTx.product.update.mockResolvedValueOnce({
        ...product,
        deletedAt: new Date('2026-07-22T00:00:00Z'),
      });

      const result = await service.softDelete('prod-123');

      expect(result.deletedAt).toBeDefined();
      expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
    });
  });

  describe('Variant Management', () => {
    describe('createVariant', () => {
      it('should create product variant and invalidate cache', async () => {
        const product = createMockProduct();
        mockTx.product.findFirst.mockResolvedValueOnce(product);
        mockTx.productVariant.findFirst.mockResolvedValue(null);

        const result = await service.createVariant('prod-123', {
          sku: 'NEW-SKU',
          barcode: 'BAR-100',
          price: 200,
          tenantId: 'tenant-123',
        });

        expect(result.sku).toBe('NEW-SKU');
        expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
      });

      it('should throw BadRequestException on duplicate SKU per tenant', async () => {
        const product = createMockProduct();
        mockTx.product.findFirst.mockResolvedValueOnce(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(createMockVariant());

        await expect(
          service.createVariant('prod-123', {
            sku: 'TEST-SKU-1',
            price: 200,
            tenantId: 'tenant-123',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw BadRequestException on duplicate barcode per tenant', async () => {
        const product = createMockProduct();
        mockTx.product.findFirst.mockResolvedValueOnce(product);
        mockTx.productVariant.findFirst
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(createMockVariant({ barcode: 'DUPLICATE-BAR' }));

        await expect(
          service.createVariant('prod-123', {
            sku: 'UNIQUE-SKU',
            barcode: 'DUPLICATE-BAR',
            price: 200,
            tenantId: 'tenant-123',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('updateVariant', () => {
      it('should update variant properties and invalidate cache', async () => {
        const product = createMockProduct();
        const existingVariant = createMockVariant({ id: 'var-1' });

        mockTx.product.findFirst.mockResolvedValueOnce(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(existingVariant);

        await service.updateVariant('prod-123', 'var-1', {
          price: 250,
          tenantId: 'tenant-123',
        });

        expect(mockTx.productVariant.update).toHaveBeenCalledWith({
          where: { id: 'var-1' },
          data: expect.objectContaining({ price: 250 }),
        });
        expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
      });

      it('should throw NotFoundException if variant does not belong to product or tenant', async () => {
        const product = createMockProduct();
        mockTx.product.findFirst.mockResolvedValueOnce(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(null);

        await expect(
          service.updateVariant('prod-123', 'var-invalid', {
            price: 250,
            tenantId: 'tenant-123',
          }),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('deleteVariant', () => {
      it('should delete variant and invalidate cache', async () => {
        const product = createMockProduct();
        const existingVariant = createMockVariant({ id: 'var-1' });

        mockTx.product.findFirst.mockResolvedValueOnce(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(existingVariant);

        await service.deleteVariant('prod-123', 'var-1', 'tenant-123');

        expect(mockTx.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'var-1' } });
        expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
      });
    });

    describe('generateVariantMatrix', () => {
      it('should generate single-option matrix combinations', async () => {
        mockTx.product.findFirst.mockResolvedValueOnce(createMockProduct());
        mockTx.productVariant.findFirst.mockResolvedValue(null);

        const result = await service.generateVariantMatrix('prod-123', {
          baseSku: 'TSHIRT',
          basePrice: 100,
          options: { size: ['S', 'M', 'L'] },
          tenantId: 'tenant-123',
        });

        expect(result).toHaveLength(3);
        expect(result[0].sku).toBe('TSHIRT-S');
        expect(result[1].sku).toBe('TSHIRT-M');
        expect(result[2].sku).toBe('TSHIRT-L');
      });

      it('should generate Cartesian product for 2 and 3 option combinations', async () => {
        mockTx.product.findFirst.mockResolvedValue(createMockProduct());
        mockTx.productVariant.findFirst.mockResolvedValue(null);

        const result = await service.generateVariantMatrix('prod-123', {
          baseSku: 'HOODIE',
          basePrice: 300,
          options: {
            size: ['S', 'M'],
            color: ['Red', 'Blue'],
            material: ['Cotton', 'Poly'],
          },
          tenantId: 'tenant-123',
        });

        expect(result).toHaveLength(8);
        expect(result[0].sku).toBe('HOODIE-S-Red-Cotton');
        expect(result[7].sku).toBe('HOODIE-M-Blue-Poly');
        expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
      });

      it('should skip existing variant SKUs gracefully without duplicate creation', async () => {
        mockTx.product.findFirst.mockResolvedValueOnce(createMockProduct());
        mockTx.productVariant.findFirst
          .mockResolvedValueOnce(createMockVariant({ sku: 'HOODIE-S-Red' })) // existing
          .mockResolvedValueOnce(null);

        const result = await service.generateVariantMatrix('prod-123', {
          baseSku: 'HOODIE',
          basePrice: 300,
          options: {
            size: ['S'],
            color: ['Red', 'Blue'],
          },
          tenantId: 'tenant-123',
        });

        expect(result).toHaveLength(1);
        expect(result[0].sku).toBe('HOODIE-S-Blue');
      });

      it('should throw BadRequestException if options object is empty', async () => {
        mockTx.product.findFirst.mockResolvedValueOnce(createMockProduct());

        await expect(
          service.generateVariantMatrix('prod-123', {
            baseSku: 'HOODIE',
            basePrice: 300,
            options: {},
            tenantId: 'tenant-123',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('Multi-Tenant Security & Exception Propagation', () => {
    it('should propagate database transaction failure during product creation', async () => {
      mockTenantPrismaService.exec.mockRejectedValueOnce(new Error('Database deadlock error'));

      await expect(
        service.create({
          storeId: 'store-123',
          titleTranslations: { en: 'Product' },
          tenantId: 'tenant-123',
        }),
      ).rejects.toThrow('Database deadlock error');
    });

    it('should strictly isolate category searches to the specified tenantId', async () => {
      mockTx.category.findMany.mockResolvedValueOnce([{ id: 'cat-1' }]);

      await service.create({
        storeId: 'store-123',
        titleTranslations: { en: 'Product' },
        tenantId: 'tenant-A',
        categoryIds: ['cat-1'],
      });

      expect(mockTx.category.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['cat-1'] }, tenantId: 'tenant-A' },
        select: { id: true },
      });
    });
  });

  describe('Cache Invalidation & explicit key tracking', () => {
    it('should track product detail and listing cache keys in a tenant set and invalidate them explicitly', async () => {
      // 1. findAll tracks cache key
      mockTx.product.findMany.mockResolvedValueOnce([]);
      mockTx.product.count.mockResolvedValueOnce(0);
      
      const query = { page: 1, limit: 10 } as any;
      const expectedListKey = `tenant:tenant-123:products:${JSON.stringify(query)}`;
      await requestContextStorage.run({ tenantId: 'tenant-123', requestId: 'r1', correlationId: 'c1' }, async () => {
        await service.findAll(query);
      });
      
      expect(mockCacheService.set).toHaveBeenCalledWith(expectedListKey, expect.any(Object), 300);
      expect(mockCacheService.sadd).toHaveBeenCalledWith('tenant:tenant-123:product-keys', expectedListKey);

      // 2. findById tracks cache key
      const product = createMockProduct({ id: 'prod-123' });
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      const expectedDetailKey = `tenant:tenant-123:product:prod-123`;
      await requestContextStorage.run({ tenantId: 'tenant-123', requestId: 'r1', correlationId: 'c1' }, async () => {
        await service.findById('prod-123');
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(expectedDetailKey, expect.any(Object), 300);
      expect(mockCacheService.sadd).toHaveBeenCalledWith('tenant:tenant-123:product-keys', expectedDetailKey);

      // 3. Update invalidates tracked keys for tenant-123 only
      mockTx.product.findFirst.mockResolvedValueOnce(product);
      mockTx.product.update.mockResolvedValueOnce(product);
      await service.update('prod-123', { isPublished: true });

      expect(mockCacheService.invalidateKeys).toHaveBeenCalledWith('tenant:tenant-123:product-keys');
    });
  });

  // =========================================================================
  // FTS Write Synchronization Tests
  // =========================================================================

  describe('FTS vector refresh — product write paths', () => {
    const tenantId = 'tenant-123';

    describe('create', () => {
      it('should call refreshProductVector after product creation', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.store.findFirst.mockResolvedValue(createMockStore());
        mockTx.product.create.mockResolvedValue(product);

        await requestContextStorage.run({ tenantId, requestId: 'r', correlationId: 'c' }, () =>
          service.create({
            tenantId,
            titleTranslations: { en: 'Test', ar: 'تجربة' },
          }),
        );

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledWith(
          mockTx,
          tenantId,
          product.id,
        );
      });

      it('should invalidate cache AFTER db.exec resolves (after refresh)', async () => {
        const callOrder: string[] = [];
        mockTx.store.findFirst.mockResolvedValue(createMockStore());
        mockTx.product.create.mockResolvedValue(createMockProduct({ tenantId }));
        mockSearchIndex.refreshProductVector.mockImplementation(async () => {
          callOrder.push('refresh');
        });
        mockCacheService.invalidateKeys.mockImplementation(async () => {
          callOrder.push('cache');
        });

        await service.create({ tenantId, titleTranslations: { en: 'Test' } });

        expect(callOrder).toEqual(['refresh', 'cache']);
      });
    });

    describe('update', () => {
      it('should refresh when titleTranslations is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue(product);

        await service.update('prod-123', { titleTranslations: { en: 'New Title' } });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
      });

      it('should refresh when descriptionTranslations is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue(product);

        await service.update('prod-123', { descriptionTranslations: { en: 'New Desc' } });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
      });

      it('should refresh when slug is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue(product);

        await service.update('prod-123', { slug: 'new-slug' });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
      });

      it('should refresh when brandId is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.brand = { findFirst: jest.fn().mockResolvedValue({ id: 'brand-1' }) } as any;
        mockTx.product.update.mockResolvedValue(product);

        await service.update('prod-123', { brandId: 'brand-1' });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
      });

      it('should NOT refresh when only isPublished is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue(product);

        await service.update('prod-123', { isPublished: false });

        expect(mockSearchIndex.refreshProductVector).not.toHaveBeenCalled();
      });

      it('should NOT refresh when only categoryIds is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue(product);
        mockTx.category.findMany.mockResolvedValue([{ id: 'cat-1' }]);

        await service.update('prod-123', { categoryIds: ['cat-1'] });

        expect(mockSearchIndex.refreshProductVector).not.toHaveBeenCalled();
      });

      it('should NOT refresh when only imageUrls is provided', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue(product);
        mockTx.productImage = {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          create: jest.fn().mockResolvedValue({}),
        } as any;

        await service.update('prod-123', { imageUrls: ['https://example.com/img.jpg'] });

        expect(mockSearchIndex.refreshProductVector).not.toHaveBeenCalled();
      });
    });

    describe('softDelete', () => {
      it('should NOT call refreshProductVector on soft delete', async () => {
        const product = createMockProduct({ tenantId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.product.update.mockResolvedValue({ ...product, deletedAt: new Date() });

        await service.softDelete('prod-123');

        expect(mockSearchIndex.refreshProductVector).not.toHaveBeenCalled();
      });
    });

    describe('refresh failure rolls back parent write', () => {
      it('should propagate ServiceUnavailableException from refresh and not invalidate cache', async () => {
        mockTx.store.findFirst.mockResolvedValue(createMockStore());
        mockTx.product.create.mockResolvedValue(createMockProduct({ tenantId }));
        mockSearchIndex.refreshProductVector.mockRejectedValueOnce(
          new ServiceUnavailableException('Search index refresh failed. The write has been rolled back.'),
        );

        await expect(
          service.create({ tenantId, titleTranslations: { en: 'Test' } }),
        ).rejects.toThrow(ServiceUnavailableException);

        // Cache must NOT be invalidated — the DB transaction was rolled back
        expect(mockCacheService.invalidateKeys).not.toHaveBeenCalled();
      });
    });
  });

  describe('FTS vector refresh — variant write paths', () => {
    const tenantId = 'tenant-123';
    const productId = 'prod-123';

    describe('createVariant', () => {
      it('should call refreshProductVector after variant creation', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.productVariant.findFirst.mockResolvedValue(null);
        mockTx.productVariant.create.mockResolvedValue(createMockVariant({ tenantId, productId }));

        await service.createVariant(productId, { sku: 'SKU-NEW', price: 100, tenantId });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledWith(mockTx, tenantId, productId);
      });
    });

    describe('updateVariant', () => {
      it('should refresh when sku is provided', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        const variant = createMockVariant({ tenantId, productId, id: 'var-1', sku: 'OLD-SKU' });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.productVariant.findFirst
          .mockResolvedValueOnce(variant)    // variant lookup
          .mockResolvedValue(null);           // SKU uniqueness check
        mockTx.productVariant.update.mockResolvedValue({ ...variant, sku: 'NEW-SKU' });

        await service.updateVariant(productId, 'var-1', { sku: 'NEW-SKU', tenantId });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
      });

      it('should refresh when isActive is provided', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        const variant = createMockVariant({ tenantId, productId, id: 'var-1' });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
        mockTx.productVariant.update.mockResolvedValue(variant);

        await service.updateVariant(productId, 'var-1', { isActive: false, tenantId });

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
      });

      it('should NOT refresh when only price is provided', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        const variant = createMockVariant({ tenantId, productId, id: 'var-1' });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
        mockTx.productVariant.update.mockResolvedValue(variant);

        await service.updateVariant(productId, 'var-1', { price: 299, tenantId });

        expect(mockSearchIndex.refreshProductVector).not.toHaveBeenCalled();
      });

      it('should NOT refresh when only weight is provided', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        const variant = createMockVariant({ tenantId, productId, id: 'var-1' });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
        mockTx.productVariant.update.mockResolvedValue(variant);

        await service.updateVariant(productId, 'var-1', { weight: 1.5, tenantId });

        expect(mockSearchIndex.refreshProductVector).not.toHaveBeenCalled();
      });
    });

    describe('deleteVariant', () => {
      it('should call refreshProductVector after variant deletion', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        const variant = createMockVariant({ tenantId, productId, id: 'var-1' });
        mockTx.product.findFirst.mockResolvedValue(product);
        mockTx.productVariant.findFirst.mockResolvedValueOnce(variant);
        mockTx.productVariant.delete.mockResolvedValue(variant);

        await service.deleteVariant(productId, 'var-1', tenantId);

        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledWith(mockTx, tenantId, productId);
      });
    });

    describe('generateVariantMatrix', () => {
      it('should refresh exactly once after all variants are created', async () => {
        const product = createMockProduct({ tenantId, id: productId });
        mockTx.product.findFirst.mockResolvedValue(product);
        // Return null for SKU uniqueness checks (all new SKUs)
        mockTx.productVariant.findFirst.mockResolvedValue(null);
        mockTx.productVariant.create.mockImplementation((args: any) =>
          Promise.resolve(createMockVariant({ sku: args.data.sku, tenantId, productId })),
        );

        await service.generateVariantMatrix(productId, {
          baseSku: 'BASE',
          basePrice: 100,
          options: { color: ['Red', 'Blue'], size: ['S', 'M'] },
          tenantId,
        });

        // 4 combinations (Red-S, Red-M, Blue-S, Blue-M) but refresh called exactly ONCE
        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledTimes(1);
        expect(mockSearchIndex.refreshProductVector).toHaveBeenCalledWith(mockTx, tenantId, productId);
      });
    });
  });
});
