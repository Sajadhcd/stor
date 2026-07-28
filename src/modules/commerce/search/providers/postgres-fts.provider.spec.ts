/**
 * PostgresFtsProvider Integration Tests
 *
 * Uses unique test tenants and stores created per run.
 * Does NOT depend on seed data.
 * Reads APP_DATABASE_URL from environment — no hardcoded credentials.
 * Full scoped cleanup in afterAll.
 */
import { PrismaClient } from '@prisma/client';
import { PostgresFtsProvider } from './postgres-fts.provider.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { ConfigService } from '../../../../infrastructure/config/config.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';

describe('PostgresFtsProvider Integration', () => {
  jest.setTimeout(30000);

  let adminPrisma: PrismaClient;
  let tenantPrismaService: TenantPrismaService;
  let provider: PostgresFtsProvider;

  // Unique IDs scoped to this test run
  let tenantAId: string;
  let tenantBId: string;
  let storeAId: string;
  let storeBId: string;
  const createdProductIds: string[] = [];

  beforeAll(async () => {
    adminPrisma = new PrismaClient();

    // Create two isolated tenants to test cross-tenant isolation
    const tenantA = await adminPrisma.tenant.create({
      data: {
        name: `fts-spec-tenant-A-${Date.now()}`,
        subdomain: `fts-a-${Date.now()}`,
      },
    });
    const tenantB = await adminPrisma.tenant.create({
      data: {
        name: `fts-spec-tenant-B-${Date.now()}`,
        subdomain: `fts-b-${Date.now()}`,
      },
    });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const storeA = await adminPrisma.store.create({
      data: {
        tenantId: tenantAId,
        name: 'FTS Spec Store A',
        currency: 'USD',
        languageDefault: 'en',
      },
    });
    const storeB = await adminPrisma.store.create({
      data: {
        tenantId: tenantBId,
        name: 'FTS Spec Store B',
        currency: 'USD',
        languageDefault: 'en',
      },
    });
    storeAId = storeA.id;
    storeBId = storeB.id;

    const mockConfig = {
      appDatabaseUrl: process.env.APP_DATABASE_URL,
    } as unknown as ConfigService;

    tenantPrismaService = new TenantPrismaService(mockConfig);
    await tenantPrismaService.onModuleInit();

    provider = new PostgresFtsProvider(tenantPrismaService);
  });

  afterAll(async () => {
    try {
      if (adminPrisma) {
        if (createdProductIds.length > 0) {
          // Delete audit logs referencing test products and tenants
          await adminPrisma.auditLog.deleteMany({
            where: { tenantId: { in: [tenantAId, tenantBId] } },
          });
          await adminPrisma.product.deleteMany({
            where: { id: { in: createdProductIds } },
          });
        }
        await adminPrisma.store.deleteMany({
          where: { id: { in: [storeAId, storeBId] } },
        });
        await adminPrisma.tenant.deleteMany({
          where: { id: { in: [tenantAId, tenantBId] } },
        });
        await adminPrisma.$disconnect();
      }
    } finally {
      if (tenantPrismaService) {
        await tenantPrismaService.onModuleDestroy();
      }
    }
  });

  it('1. should normalize Arabic text correctly using normalize_arabic() SQL function', async () => {
    const testCases = [
      { input: 'أَبْجَدْ هَوَّزْ طِيْنْ', expected: 'ابجد هوز طين' },
      { input: 'الْعَرَبِيَّةُ ى ة', expected: 'العربيه ي ه' },
      { input: 'إِسْلَامِيَّةٌ آ ٱ', expected: 'اسلاميه ا ا' },
    ];

    for (const tc of testCases) {
      const res = await adminPrisma.$queryRaw<Array<{ normalize_arabic: string }>>`
        SELECT normalize_arabic(${tc.input}::text) AS normalize_arabic
      `;
      expect(res[0].normalize_arabic).toBe(tc.expected);
    }
  });

  it('2. should verify that the tsv_search column and its GIN index exist in the database', async () => {
    const columns = await adminPrisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'tsv_search'
    `;
    expect(columns.length).toBe(1);

    const indexes = await adminPrisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'products' AND indexdef LIKE '%gin%tsv_search%'
    `;
    expect(indexes.length).toBeGreaterThanOrEqual(1);
  });

  it('3. should verify update_product_search_vector(uuid, uuid) is the only form granted to nexio_app', async () => {
    // The 1-arg form must NOT be executable by nexio_app
    await requestContextStorage.run(
      { tenantId: tenantAId, requestId: 'priv-check', correlationId: 'priv-check' },
      async () => {
        await expect(
          tenantPrismaService.exec(async (tx) => {
            await tx.$executeRaw`SELECT update_product_search_vector(${tenantAId}::uuid)`;
          }),
        ).rejects.toThrow(); // PERMISSION_DENIED

        // The 2-arg form must succeed (correct tenant/product — no product with this id, so no-op)
        await expect(
          tenantPrismaService.exec(async (tx) => {
            await tx.$executeRaw`SELECT update_product_search_vector(${tenantAId}::uuid, ${'00000000-0000-0000-0000-000000000000'}::uuid)`;
          }),
        ).resolves.not.toThrow();
      },
    );
  });

  it('4. should generate ranked matching results and respect tenant isolation', async () => {
    // Product 1 (tenant A): title match
    const p1 = await adminPrisma.product.create({
      data: {
        tenantId: tenantAId,
        storeId: storeAId,
        titleTranslations: { ar: 'حذاء جري رياضي مريح', en: 'Running Shoes' },
        descriptionTranslations: { ar: 'وصف المنتج', en: 'Desc' },
        isPublished: true,
      },
    });
    createdProductIds.push(p1.id);

    // Product 2 (tenant A): description match only (lower rank expected)
    const p2 = await adminPrisma.product.create({
      data: {
        tenantId: tenantAId,
        storeId: storeAId,
        titleTranslations: { ar: 'تي شيرت رياضي', en: 'Sports Tee' },
        descriptionTranslations: { ar: 'يحتوي على حذاء جري في الوصف', en: 'Desc' },
        isPublished: true,
      },
    });
    createdProductIds.push(p2.id);

    // Product 3 (tenant B): title match — must NOT appear in tenant A searches
    const p3 = await adminPrisma.product.create({
      data: {
        tenantId: tenantBId,
        storeId: storeBId,
        titleTranslations: { ar: 'حذاء شتوي دافئ', en: 'Winter Shoes' },
        isPublished: true,
      },
    });
    createdProductIds.push(p3.id);

    // Refresh vectors via the 2-arg function under tenant A context
    await requestContextStorage.run(
      { tenantId: tenantAId, requestId: 'vec-A', correlationId: 'vec-A' },
      async () => {
        await provider.refreshProductVector(p1.id);
        await provider.refreshProductVector(p2.id);
      },
    );

    // Refresh p3 under tenant B context
    await requestContextStorage.run(
      { tenantId: tenantBId, requestId: 'vec-B', correlationId: 'vec-B' },
      async () => {
        await provider.refreshProductVector(p3.id);
      },
    );

    // Search under tenant A context
    await requestContextStorage.run(
      { tenantId: tenantAId, requestId: 'search-A', correlationId: 'search-A' },
      async () => {
        const result = await provider.search(tenantAId, { query: 'حذاء', isPublished: true });

        const filtered = result.items.filter(i => i.id === p1.id || i.id === p2.id);
        expect(filtered.length).toBe(2);
        // p1 (title match) must rank higher than p2 (description match)
        expect(filtered[0].id).toBe(p1.id);
        expect(filtered[1].id).toBe(p2.id);
        expect(filtered[0].score).toBeGreaterThan(filtered[1].score);

        // p3 from tenant B must never appear
        expect(result.items.map(i => i.id)).not.toContain(p3.id);
      },
    );

    // Search under tenant B context — only p3 should appear for this query
    await requestContextStorage.run(
      { tenantId: tenantBId, requestId: 'search-B', correlationId: 'search-B' },
      async () => {
        const result = await provider.search(tenantBId, { query: 'حذاء', isPublished: true });
        const ours = result.items.filter(i => i.id === p3.id);
        expect(ours.length).toBe(1);
        // p1 and p2 from tenant A must never appear
        expect(result.items.map(i => i.id)).not.toContain(p1.id);
        expect(result.items.map(i => i.id)).not.toContain(p2.id);
      },
    );
  });

  it('5. cross-tenant call to update_product_search_vector is a no-op (wrong tenant)', async () => {
    // Create a product under tenant B
    const pB = await adminPrisma.product.create({
      data: {
        tenantId: tenantBId,
        storeId: storeBId,
        titleTranslations: { en: 'Cross-Tenant Test' },
        isPublished: true,
      },
    });
    createdProductIds.push(pB.id);

    // Call refresh from tenant A context with tenant B's product ID
    // The SQL function's NOT FOUND guard must make this a silent no-op
    await requestContextStorage.run(
      { tenantId: tenantAId, requestId: 'cross', correlationId: 'cross' },
      async () => {
        // This must not throw and must not update pB's tsv_search
        await expect(
          tenantPrismaService.exec(async (tx) => {
            await tx.$executeRaw`SELECT update_product_search_vector(${tenantAId}::uuid, ${pB.id}::uuid)`;
          }),
        ).resolves.not.toThrow();
      },
    );

    // Confirm tsv_search on pB was NOT updated by the cross-tenant call
    const pBRow = await adminPrisma.$queryRaw<Array<{ tsv: string | null }>>`
      SELECT tsv_search::text AS tsv FROM products WHERE id = ${pB.id}::uuid
    `;
    // It should still be null (never been correctly refreshed yet)
    expect(pBRow[0].tsv).toBeNull();
  });
});
