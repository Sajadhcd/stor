import { PrismaClient } from '@prisma/client';
import { PostgresFtsProvider } from './postgres-fts.provider.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { ConfigService } from '../../../../infrastructure/config/config.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';

describe('PostgresFtsProvider Integration', () => {
  let adminPrisma: PrismaClient;
  let tenantPrismaService: TenantPrismaService;
  let provider: PostgresFtsProvider;

  let tenantId1: string;
  let tenantId2: string;
  let storeId1: string;
  let storeId2: string;

  const testProductIds: string[] = [];

  beforeAll(async () => {
    adminPrisma = new PrismaClient();

    // Clean up any orphaned test products from previous failed runs
    await adminPrisma.product.deleteMany({
      where: {
        OR: [
          { titleTranslations: { path: ['ar'], equals: 'حذاء جري رياضي مريح جداً' } },
          { titleTranslations: { path: ['ar'], equals: 'تي شيرت رياضي مميز' } },
          { titleTranslations: { path: ['ar'], equals: 'حذاء شتوي دافئ' } },
        ]
      }
    });

    // Dynamically retrieve two stores from different tenants
    const store1 = await adminPrisma.store.findFirst();
    if (!store1) {
      throw new Error('Test database does not have any stores.');
    }
    const store2 = await adminPrisma.store.findFirst({
      where: {
        tenantId: { not: store1.tenantId }
      }
    });
    if (!store2) {
      throw new Error('Test database does not have stores on different tenants to perform isolation tests.');
    }
    
    tenantId1 = store1.tenantId;
    tenantId2 = store2.tenantId;
    storeId1 = store1.id;
    storeId2 = store2.id;

    // Mock ConfigService
    const mockConfig = {
      appDatabaseUrl: process.env.APP_DATABASE_URL || 'postgresql://nexio_app:nAx--aXaRYFt1wszxf_QfUalMpOak5vJDAKh8L1grdIDpqjL@localhost:5432/nexio_commerce?schema=public',
    } as unknown as ConfigService;

    tenantPrismaService = new TenantPrismaService(mockConfig);
    await tenantPrismaService.onModuleInit();

    provider = new PostgresFtsProvider(tenantPrismaService);
  });

  afterAll(async () => {
    // Cleanup test products safely
    if (adminPrisma && testProductIds.length > 0) {
      try {
        await adminPrisma.product.deleteMany({
          where: { id: { in: testProductIds } },
        });
      } catch (err) {
        console.error('Error during test cleanup:', err);
      }
    }
    if (adminPrisma) {
      await adminPrisma.$disconnect();
    }
    if (tenantPrismaService) {
      await tenantPrismaService.onModuleDestroy();
    }
  });

  it('1. should normalize Arabic text correctly using normalize_arabic() SQL function', async () => {
    const testCases = [
      { input: 'أَبْجَدْ هَوَّزْ طِيْنْ', expected: 'ابجد هوز طين' },
      { input: 'الْعَرَبِيَّةُ ى ة', expected: 'العربيه ي ه' },
      { input: 'إِسْلَامِيَّةٌ آ ٱ', expected: 'اسلاميه ا ا' },
    ];

    for (const tc of testCases) {
      const res = await adminPrisma.$queryRawUnsafe<Array<{ normalize_arabic: string }>>(
        `SELECT normalize_arabic($1) AS normalize_arabic`,
        tc.input
      );
      expect(res[0].normalize_arabic).toBe(tc.expected);
    }
  });

  it('2. should verify that the tsv_search column and its GIN index exist in the database', async () => {
    // Check column existence
    const columns = await adminPrisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'tsv_search'`
    );
    expect(columns.length).toBe(1);

    // Check index existence
    const indexes = await adminPrisma.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'products' AND indexdef LIKE '%gin%tsv_search%'`
    );
    expect(indexes.length).toBeGreaterThanOrEqual(1);
  });

  it('3. should generate ranked matching results and respect tenant isolation and filters', async () => {
    // Create 3 test products:
    // Product 1: Tenant 1, matches search term 'حذاء' (shoes) in title
    const p1 = await adminPrisma.product.create({
      data: {
        tenantId: tenantId1,
        storeId: storeId1,
        titleTranslations: { ar: 'حذاء جري رياضي مريح جداً', en: 'Running Shoes' },
        descriptionTranslations: { ar: 'وصف المنتج', en: 'Desc' },
        isPublished: true,
      },
    });
    testProductIds.push(p1.id);

    // Product 2: Tenant 1, matches search term 'حذاء' in description
    const p2 = await adminPrisma.product.create({
      data: {
        tenantId: tenantId1,
        storeId: storeId1,
        titleTranslations: { ar: 'تي شيرت رياضي مميز', en: 'Tech Tee' },
        descriptionTranslations: { ar: 'منتج ممتاز يحتوي على حذاء جري في الوصف الداخلي تفصيلاً', en: 'Desc' },
        isPublished: true,
      },
    });
    testProductIds.push(p2.id);

    // Product 3: Tenant 2, matches search term 'حذاء' in title, but on Tenant 2
    const p3 = await adminPrisma.product.create({
      data: {
        tenantId: tenantId2,
        storeId: storeId2,
        titleTranslations: { ar: 'حذاء شتوي دافئ', en: 'Warm winter shoes' },
        isPublished: true,
      },
    });
    testProductIds.push(p3.id);

    // Manually refresh search vectors under the correct tenant contexts
    await requestContextStorage.run(
      { tenantId: tenantId1, requestId: 'test-req', correlationId: 'test-corr' },
      async () => {
        await provider.refreshProductVector(p1.id);
        await provider.refreshProductVector(p2.id);
      }
    );

    await requestContextStorage.run(
      { tenantId: tenantId2, requestId: 'test-req-2', correlationId: 'test-corr-2' },
      async () => {
        await provider.refreshProductVector(p3.id);
      }
    );

    // Run search under Tenant 1 Context
    await requestContextStorage.run(
      { tenantId: tenantId1, requestId: 'test-req', correlationId: 'test-corr' },
      async () => {
        const searchResult = await provider.search(tenantId1, {
          query: 'حذاء',
          isPublished: true,
        });

        // Filter search results to only include the products we created in this run
        const filteredItems = searchResult.items.filter(item => 
          item.id === p1.id || item.id === p2.id
        );

        // Verify total matches for our test products
        expect(filteredItems.length).toBe(2);

        // Product 1 (matches in title) should be first and score higher than Product 2 (matches in description)
        expect(filteredItems[0].id).toBe(p1.id);
        expect(filteredItems[1].id).toBe(p2.id);
        expect(filteredItems[0].score).toBeGreaterThan(filteredItems[1].score);

        // Ensure Product 3 (Tenant 2) is NOT in the search results
        const matchingIds = searchResult.items.map(item => item.id);
        expect(matchingIds).not.toContain(p3.id);
      }
    );

    // Run search under Tenant 2 Context
    await requestContextStorage.run(
      { tenantId: tenantId2, requestId: 'test-req-2', correlationId: 'test-corr-2' },
      async () => {
        const searchResult = await provider.search(tenantId2, {
          query: 'حذاء',
          isPublished: true,
        });

        // Under Tenant 2, only Product 3 should match
        expect(searchResult.total).toBe(1);
        expect(searchResult.items[0].id).toBe(p3.id);
      }
    );
  });
});
