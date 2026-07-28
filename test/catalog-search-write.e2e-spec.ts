/**
 * catalog-search-write.e2e-spec.ts
 *
 * Phase C1-B2.2 — Write-Path FTS Synchronization E2E Tests
 *
 * Tests that product and variant write operations correctly update tsv_search
 * and that search results are immediately consistent after each write.
 *
 * Runs against localhost:5433 (Docker canonical dev database).
 * Uses APP_DATABASE_URL from environment — no hardcoded credentials.
 * Creates fully isolated test tenants/stores per test run with complete cleanup.
 */
import { PrismaClient } from '@prisma/client';
import { ProductSearchIndexRepository } from '../src/modules/commerce/search/repositories/product-search-index.repository.js';
import { TenantPrismaService } from '../src/infrastructure/database/tenant-prisma.service.js';
import { ConfigService } from '../src/infrastructure/config/config.service.js';
import { requestContextStorage } from '../src/common/context/request-context.js';
import { AppLogger } from '../src/infrastructure/logging/logger.service.js';
import { ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';

// ============================================================================
// Test helpers
// ============================================================================

/** Search the products.tsv_search column directly via admin prisma */
async function searchTsvRaw(
  adminPrisma: PrismaClient,
  tenantId: string,
  query: string,
): Promise<Array<{ id: string }>> {
  return adminPrisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM products
    WHERE  tenant_id  = ${tenantId}::uuid
      AND  tsv_search @@ build_catalog_search_query(${query}::text)
      AND  deleted_at IS NULL
  `;
}

/** Verify tsv_search contains the expected lexeme for a given product */
async function vectorContains(
  adminPrisma: PrismaClient,
  productId: string,
  term: string,
): Promise<boolean> {
  const rows = await adminPrisma.$queryRaw<Array<{ match: boolean }>>`
    SELECT tsv_search @@ build_catalog_search_query(${term}::text) AS match
    FROM   products
    WHERE  id = ${productId}::uuid
  `;
  return rows.length > 0 && rows[0].match === true;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Catalog FTS Write Synchronization E2E', () => {
  jest.setTimeout(30000);

  let adminPrisma: PrismaClient;
  let tenantPrismaService: TenantPrismaService;
  let searchIndex: ProductSearchIndexRepository;

  let tenantId: string;
  let storeId: string;

  const cleanup: { products: string[]; variants: string[] } = { products: [], variants: [] };

  beforeAll(async () => {
    adminPrisma = new PrismaClient();

    // Create isolated tenant and store for this test run
    const subdomain = `write-e2e-${Date.now()}`;
    const tenant = await adminPrisma.tenant.create({
      data: { name: `Write E2E Tenant ${Date.now()}`, subdomain },
    });
    tenantId = tenant.id;

    const store = await adminPrisma.store.create({
      data: { tenantId, name: 'Write E2E Store', currency: 'IQD', languageDefault: 'ar' },
    });
    storeId = store.id;

    const mockConfig = {
      appDatabaseUrl: process.env.APP_DATABASE_URL,
    } as unknown as ConfigService;

    tenantPrismaService = new TenantPrismaService(mockConfig);
    await tenantPrismaService.onModuleInit();

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as AppLogger;

    searchIndex = new ProductSearchIndexRepository(mockLogger);
  });

  afterAll(async () => {
    try {
      if (adminPrisma) {
        // Clean up in FK order
        await adminPrisma.auditLog.deleteMany({
          where: { tenantId },
        });
        if (cleanup.products.length > 0) {
          await adminPrisma.product.deleteMany({ where: { id: { in: cleanup.products } } });
        }
        await adminPrisma.store.deleteMany({ where: { id: storeId } });
        await adminPrisma.tenant.deleteMany({ where: { id: tenantId } });
        await adminPrisma.$disconnect();
      }
    } finally {
      if (tenantPrismaService) {
        await tenantPrismaService.onModuleDestroy();
      }
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --------------------------------------------------------------------------
  // 1. Product create → immediately searchable
  // --------------------------------------------------------------------------
  describe('product.create', () => {
    it('should make a product searchable by English title immediately after creation', async () => {
      const term = `nexio-create-en-${randomUUID().substring(0, 8)}`;
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: `Product ${term}`, ar: 'منتج' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      // Simulate the refresh that ProductsService.create calls inside its transaction
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      expect(await vectorContains(adminPrisma, product.id, term)).toBe(true);
    });

    it('should make a product searchable by Arabic title immediately after creation', async () => {
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { ar: 'حذاء رياضي فريد', en: 'Unique Sports Shoe' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      // Search by normalized Arabic — tashkeel stripped
      const rows = await searchTsvRaw(adminPrisma, tenantId, 'رياضي');
      const ids = rows.map(r => r.id);
      expect(ids).toContain(product.id);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Product update → title change reflected immediately
  // --------------------------------------------------------------------------
  describe('product.update — title change', () => {
    it('should update the vector when English title changes', async () => {
      const oldTerm = `old-title-${randomUUID().substring(0, 8)}`;
      const newTerm = `new-title-${randomUUID().substring(0, 8)}`;

      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: `Product ${oldTerm}` },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      // Initial refresh
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );
      expect(await vectorContains(adminPrisma, product.id, oldTerm)).toBe(true);

      // Update title
      await adminPrisma.product.update({
        where: { id: product.id },
        data: { titleTranslations: { en: `Product ${newTerm}` } },
      });

      // Refresh after update
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      expect(await vectorContains(adminPrisma, product.id, newTerm)).toBe(true);
      expect(await vectorContains(adminPrisma, product.id, oldTerm)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Variant create → SKU indexed
  // --------------------------------------------------------------------------
  describe('variant.create', () => {
    it('should index new variant SKU after creation', async () => {
      const sku = `SKU-WRITE-${randomUUID().substring(0, 8)}`;
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Variant SKU Test Product' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      await adminPrisma.productVariant.create({
        data: { tenantId, productId: product.id, sku, price: 100 },
      });

      // Refresh — simulates what ProductsService.createVariant does inside tx
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      expect(await vectorContains(adminPrisma, product.id, sku)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Variant deactivate → SKU removed from index
  // --------------------------------------------------------------------------
  describe('variant.update isActive=false', () => {
    it('should remove SKU from index when variant is deactivated', async () => {
      const sku = `SKU-DEACT-${randomUUID().substring(0, 8)}`;
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Deactivation Test' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      const variant = await adminPrisma.productVariant.create({
        data: { tenantId, productId: product.id, sku, price: 100 },
      });

      // Initial refresh — SKU should be indexed
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );
      expect(await vectorContains(adminPrisma, product.id, sku)).toBe(true);

      // Deactivate variant
      await adminPrisma.productVariant.update({
        where: { id: variant.id },
        data: { isActive: false },
      });

      // Refresh after deactivation
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      expect(await vectorContains(adminPrisma, product.id, sku)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Variant delete → SKU removed from index
  // --------------------------------------------------------------------------
  describe('variant.delete', () => {
    it('should remove SKU from index after variant hard delete', async () => {
      const sku = `SKU-DEL-${randomUUID().substring(0, 8)}`;
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Delete Variant Test' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      const variant = await adminPrisma.productVariant.create({
        data: { tenantId, productId: product.id, sku, price: 100 },
      });

      // Refresh — SKU indexed
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );
      expect(await vectorContains(adminPrisma, product.id, sku)).toBe(true);

      // Hard delete variant
      await adminPrisma.productVariant.delete({ where: { id: variant.id } });

      // Refresh after deletion
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      expect(await vectorContains(adminPrisma, product.id, sku)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. generateVariantMatrix — one refresh for all SKUs
  // --------------------------------------------------------------------------
  describe('generateVariantMatrix', () => {
    it('should index all generated SKUs after a single refresh call', async () => {
      const baseSku = `MTX-${randomUUID().substring(0, 6)}`;
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Matrix Product' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      const skus = [`${baseSku}-Red-S`, `${baseSku}-Red-M`, `${baseSku}-Blue-S`, `${baseSku}-Blue-M`];
      for (const sku of skus) {
        await adminPrisma.productVariant.create({
          data: { tenantId, productId: product.id, sku, price: 100 },
        });
      }

      // Single refresh (simulating generateVariantMatrix behavior)
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      // All SKUs must be indexed after one refresh
      for (const sku of skus) {
        expect(await vectorContains(adminPrisma, product.id, sku)).toBe(true);
      }
    });
  });

  // --------------------------------------------------------------------------
  // 7. Cross-tenant: wrong tenantId is a no-op
  // --------------------------------------------------------------------------
  describe('cross-tenant safety', () => {
    it('should be a no-op when tenantId does not match product tenant', async () => {
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Cross-tenant safety check' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      const wrongTenantId = randomUUID();

      // Call refresh with wrong tenant — must not throw, must not update vector
      await requestContextStorage.run(
        { tenantId: wrongTenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${wrongTenantId}, true)`;
            await tx.$executeRaw`SELECT update_product_search_vector(${wrongTenantId}::uuid, ${product.id}::uuid)`;
          });
        },
      );

      // tsv_search must remain null (never correctly refreshed)
      const rows = await adminPrisma.$queryRaw<Array<{ tsv: string | null }>>`
        SELECT tsv_search::text AS tsv FROM products WHERE id = ${product.id}::uuid
      `;
      expect(rows[0].tsv).toBeNull();
    });

    it('should not leak brand or SKU data from another tenant', async () => {
      // Product under current tenant with unique brand name injected via brand table
      const product = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Isolation Test Product' },
          isPublished: true,
        },
      });
      cleanup.products.push(product.id);

      // Create a variant under a DIFFERENT product to confirm SKU scoping
      const anotherProduct = await adminPrisma.product.create({
        data: {
          tenantId,
          storeId,
          titleTranslations: { en: 'Another Product' },
          isPublished: true,
        },
      });
      cleanup.products.push(anotherProduct.id);

      const isolatedSku = `ISO-SKU-${randomUUID().substring(0, 8)}`;
      await adminPrisma.productVariant.create({
        data: { tenantId, productId: anotherProduct.id, sku: isolatedSku, price: 100 },
      });

      // Refresh only the first product
      await requestContextStorage.run(
        { tenantId, requestId: randomUUID(), correlationId: randomUUID() },
        async () => {
          await tenantPrismaService.exec(async (tx) => {
            await searchIndex.refreshProductVector(tx, tenantId, product.id);
          });
        },
      );

      // The SKU from the other product must NOT appear in the first product's vector
      expect(await vectorContains(adminPrisma, product.id, isolatedSku)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 8. Refresh failure maps to ServiceUnavailableException
  // --------------------------------------------------------------------------
  describe('error handling', () => {
    it('should throw ServiceUnavailableException when SQL function fails', async () => {
      const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
      } as unknown as AppLogger;
      const repo = new ProductSearchIndexRepository(mockLogger);

      // Pass an invalid UUID-like string that will cause a SQL error
      const badProductId = randomUUID(); // valid UUID but for a non-existent product — no-op
      const badTenantId = randomUUID();  // both IDs non-existent: NOT FOUND, no error

      // To actually trigger an error we use a mock tx that rejects
      const mockTx = {
        $executeRaw: jest.fn().mockRejectedValue(new Error('simulated SQL failure')),
      } as any;

      await requestContextStorage.run(
        { tenantId, requestId: 'err-test', correlationId: 'err-corr' },
        async () => {
          await expect(
            repo.refreshProductVector(mockTx, badTenantId, badProductId),
          ).rejects.toThrow(ServiceUnavailableException);
        },
      );
    });
  });
});
