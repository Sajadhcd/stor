import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { requestContextStorage } from '../src/common/context/request-context';
import { CatalogSearchRepository } from '../src/modules/commerce/catalog/repositories/catalog-search.repository.js';
import { TenantPrismaService } from '../src/infrastructure/database/tenant-prisma.service.js';
import { ConfigService } from '../src/infrastructure/config/config.service.js';

describe('Catalog Search Integration E2E', () => {
  let adminPrisma: PrismaClient;
  let tenantPrismaService: TenantPrismaService;
  let repository: CatalogSearchRepository;

  const tenantAId = randomUUID();
  const storeAId = randomUUID();
  const productEnglishId = randomUUID();
  const productArabicId = randomUUID();
  const productMixedId = randomUUID();
  const productDuplicateVarId = randomUUID();

  beforeAll(async () => {
    adminPrisma = new PrismaClient();

    // Create Tenant & Store
    await adminPrisma.tenant.create({
      data: { id: tenantAId, name: 'Tenant A', subdomain: `tenant-a-${randomUUID().substring(0, 8)}` }
    });

    await adminPrisma.store.create({
      data: { id: storeAId, tenantId: tenantAId, name: 'Store A' }
    });

    // Create Products
    await adminPrisma.product.createMany({
      data: [
        {
          id: productEnglishId,
          tenantId: tenantAId,
          storeId: storeAId,
          titleTranslations: { en: 'Super Fast Laptop 16GB' },
          isPublished: true,
        },
        {
          id: productArabicId,
          tenantId: tenantAId,
          storeId: storeAId,
          titleTranslations: { ar: 'لابتوب سريع جدا' },
          isPublished: true,
        },
        {
          id: productMixedId,
          tenantId: tenantAId,
          storeId: storeAId,
          titleTranslations: { en: 'Smartphone Pro', ar: 'هاتف ذكي برو' },
          isPublished: true,
        },
        {
          id: productDuplicateVarId,
          tenantId: tenantAId,
          storeId: storeAId,
          titleTranslations: { en: 'Multiple Variants Item' },
          isPublished: true,
        },
      ]
    });

    // Create Variants
    await adminPrisma.productVariant.createMany({
      data: [
        {
          id: randomUUID(),
          tenantId: tenantAId,
          productId: productEnglishId,
          sku: `SKU-${randomUUID().substring(0, 8)}`,
          price: 1500,
          isActive: true,
        },
        {
          id: randomUUID(),
          tenantId: tenantAId,
          productId: productArabicId,
          sku: `SKU-${randomUUID().substring(0, 8)}`,
          price: 2000,
          isActive: true,
        },
        {
          id: randomUUID(),
          tenantId: tenantAId,
          productId: productMixedId,
          sku: `SKU-${randomUUID().substring(0, 8)}`,
          price: 3000,
          isActive: true,
        },
        // Duplicate variants for one product to test LEFT JOIN LATERAL price calculation
        {
          id: randomUUID(),
          tenantId: tenantAId,
          productId: productDuplicateVarId,
          sku: `SKU-${randomUUID().substring(0, 8)}`,
          price: 50,
          isActive: true,
        },
        {
          id: randomUUID(),
          tenantId: tenantAId,
          productId: productDuplicateVarId,
          sku: `SKU-${randomUUID().substring(0, 8)}`,
          price: 25, // This should be the effective price
          isActive: true,
        },
        {
          id: randomUUID(),
          tenantId: tenantAId,
          productId: productDuplicateVarId,
          sku: `SKU-${randomUUID().substring(0, 8)}`,
          price: 100,
          isActive: true,
        },
      ]
    });

    // Wait for the trigger to enqueue FTS updates, but we need to run them immediately for testing.
    // In test environment, we manually run the update function to ensure vectors are populated.
    await adminPrisma.$executeRawUnsafe(`
      SELECT update_all_product_search_vectors('${tenantAId}'::uuid)
    `);

    // Setup repository
    const mockConfig = {
      appDatabaseUrl: process.env.APP_DATABASE_URL,
    } as unknown as ConfigService;

    tenantPrismaService = new TenantPrismaService(mockConfig);
    await tenantPrismaService.onModuleInit();

    repository = new CatalogSearchRepository(tenantPrismaService);
  });

  afterAll(async () => {
    // Clean up
    if (adminPrisma) {
      await adminPrisma.auditLog.deleteMany({ where: { rowId: { in: [tenantAId, storeAId, productEnglishId, productArabicId, productMixedId, productDuplicateVarId] } } });
      await adminPrisma.productVariant.deleteMany({ where: { productId: { in: [productEnglishId, productArabicId, productMixedId, productDuplicateVarId] } } });
      await adminPrisma.product.deleteMany({ where: { id: { in: [productEnglishId, productArabicId, productMixedId, productDuplicateVarId] } } });
      await adminPrisma.store.deleteMany({ where: { id: { in: [storeAId] } } });

      // Cleanup audit logs for tenant deletion
      await adminPrisma.auditLog.deleteMany({ where: { tenantId: tenantAId } });
      await adminPrisma.tenant.deleteMany({ where: { id: { in: [tenantAId] } } });

      await adminPrisma.$disconnect();
    }
    if (tenantPrismaService) {
      await tenantPrismaService.onModuleDestroy();
    }
  });

  it('should find products using English search', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: 'Laptop' }, []);
        expect(res.total).toBeGreaterThanOrEqual(1);
        expect(res.items.some(i => i.id === productEnglishId)).toBe(true);
      });
    });
  });

  it('should find products using Arabic search with normalization', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: 'لابتوب' }, []);
        expect(res.total).toBeGreaterThanOrEqual(1);
        expect(res.items.some(i => i.id === productArabicId)).toBe(true);
      });
    });
  });

  it('should find products using mixed Arabic/English search', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: 'برو smartphone' }, []);
        expect(res.total).toBeGreaterThanOrEqual(1);
        expect(res.items.some(i => i.id === productMixedId)).toBe(true);
      });
    });
  });

  it('should return empty results for symbols-only search', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: '!@#$%^&*()' }, []);
        expect(res.total).toBe(0);
        expect(res.items).toHaveLength(0);
      });
    });
  });

  it('should filter by price correctly', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: 'سريع', minPrice: 1900, maxPrice: 2100 }, []);
        expect(res.total).toBe(1);
        expect(res.items[0].id).toBe(productArabicId);
      });
    });
  });

  it('should return 1 duplicate variant product exactly once', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: 'Multiple Variants' }, []);
        expect(res.total).toBe(1);
        expect(res.items).toHaveLength(1);
        expect(res.items[0].id).toBe(productDuplicateVarId);
      });
    });
  });

  it('should correctly sort by price ascending and calculate effective price via LEFT JOIN LATERAL', async () => {
    await requestContextStorage.run({ tenantId: tenantAId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, tenantAId, { query: 'sku', sortBy: 'price_asc' }, []);

        expect(res.items.length).toBeGreaterThanOrEqual(4);
        expect(res.items[0].id).toBe(productDuplicateVarId);
      });
    });
  });

  it('should correctly enforce tenant isolation', async () => {
    const randomTenantId = randomUUID();
    await requestContextStorage.run({ tenantId: randomTenantId }, async () => {
      await tenantPrismaService.exec(async (tx) => {
        const res = await repository.searchRankedProductIds(tx, randomTenantId, { query: 'Laptop' }, []);
        expect(res.total).toBe(0);
        expect(res.items).toHaveLength(0);
      });
    });
  });
});
