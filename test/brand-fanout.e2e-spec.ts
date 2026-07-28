import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module.js';
import { TenantPrismaService } from '../src/infrastructure/database/tenant-prisma.service.js';
import { BrandsService } from '../src/modules/commerce/catalog/brands/brands.service.js';
import { requestContextStorage } from '../src/common/context/request-context.js';

describe('Brand-Rename-FTS-Fan-out-E2E', () => {
  let app: INestApplication;
  let db: TenantPrismaService;
  let brandsService: BrandsService;

  const TENANT_ID = '11111111-1111-4111-a111-111111111111';
  const STORE_ID = '22222222-2222-4222-a222-222222222222';
  const BRAND_ID = '33333333-3333-4333-a333-333333333333';
  const CAT_ID = '44444444-4444-4444-a444-444444444444';
  const PROD1_ID = '55555555-5555-4555-a555-555555555555';
  const PROD2_ID = '66666666-6666-4666-a666-666666666666';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    db = app.get<TenantPrismaService>(TenantPrismaService);
    brandsService = app.get<BrandsService>(BrandsService);

    // Seed data
    await db.runAsTenant(TENANT_ID, async (tx) => {
      // Create tenant if not exists to satisfy FK
      await tx.$executeRaw`INSERT INTO tenants (id, name, subdomain) VALUES (${TENANT_ID}::uuid, 'Fanout Tenant', 'fanout-tenant-' || extract(epoch from now())::text) ON CONFLICT (id) DO NOTHING`;
      await tx.$executeRaw`INSERT INTO stores (id, tenant_id, name) VALUES (${STORE_ID}::uuid, ${TENANT_ID}::uuid, 'Fanout Store') ON CONFLICT (id) DO NOTHING`;

      // Clear data
      await tx.$executeRaw`DELETE FROM products WHERE tenant_id = ${TENANT_ID}::uuid`;
      await tx.$executeRaw`DELETE FROM brands WHERE tenant_id = ${TENANT_ID}::uuid`;
      await tx.$executeRaw`DELETE FROM categories WHERE tenant_id = ${TENANT_ID}::uuid`;

      // Create brand
      const brand = await tx.brand.create({
        data: {
          id: BRAND_ID,
          tenantId: TENANT_ID,
          name: 'OldFanoutBrand',
          slug: 'old-fanout-brand',
        },
      });

      // Create Category
      const cat = await tx.category.create({
        data: {
          id: CAT_ID,
          tenantId: TENANT_ID,
          nameTranslations: { en: 'Fanout Category' },
          slug: 'fanout-category',
        },
      });

      // Create Products
      await tx.product.create({
        data: {
          id: PROD1_ID,
          tenantId: TENANT_ID,
          storeId: STORE_ID,
          titleTranslations: { en: 'Product One' },
          slug: 'prod-fanout-1',
          descriptionTranslations: { en: 'Description 1' },
          brandId: brand.id,
        },
      });

      await tx.product.create({
        data: {
          id: PROD2_ID,
          tenantId: TENANT_ID,
          storeId: STORE_ID,
          titleTranslations: { en: 'Product Two' },
          slug: 'prod-fanout-2',
          descriptionTranslations: { en: 'Description 2' },
          brandId: brand.id,
        },
      });
    });
    
    // Explicitly refresh vectors once so they have the old brand name
    await db.runAsTenant(TENANT_ID, async (tx) => {
      await tx.$executeRaw`SELECT update_product_search_vector(${TENANT_ID}::uuid, ${PROD1_ID}::uuid)`;
      await tx.$executeRaw`SELECT update_product_search_vector(${TENANT_ID}::uuid, ${PROD2_ID}::uuid)`;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('verifies initial vectors match the old brand name', async () => {
    const term = 'OldFanoutBrand';
    
    const results = await db.runAsTenant(TENANT_ID, async (tx) => {
      return tx.$queryRawUnsafe<any[]>(
        `SELECT id FROM products WHERE tenant_id = '${TENANT_ID}' AND tsv_search @@ build_catalog_search_query('${term}')`
      );
    });

    expect(results.length).toBe(2);
  });

  it('updates brand name, enqueues job, and eventually updates search vectors', async () => {
    // 1. Rename the brand via Service layer wrapped in AsyncLocalStorage
    await requestContextStorage.run({ tenantId: TENANT_ID, correlationId: 'e2e-fanout' }, async () => {
      await brandsService.update(BRAND_ID, {
        name: 'NewAmazingBrand',
      });
    });

    // 2. Wait a bit for the BullMQ worker to process the job in the background
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 3. Verify old brand name no longer matches
    const oldTerm = 'OldFanoutBrand';
    const oldResults = await db.runAsTenant(TENANT_ID, async (tx) => {
      return tx.$queryRawUnsafe<any[]>(
        `SELECT id FROM products WHERE tenant_id = '${TENANT_ID}' AND tsv_search @@ build_catalog_search_query('${oldTerm}')`
      );
    });
    expect(oldResults.length).toBe(0);

    // 4. Verify new brand name matches
    const newTerm = 'NewAmazingBrand';
    const newResults = await db.runAsTenant(TENANT_ID, async (tx) => {
      return tx.$queryRawUnsafe<any[]>(
        `SELECT id, title_translations FROM products WHERE tenant_id = '${TENANT_ID}' AND tsv_search @@ build_catalog_search_query('${newTerm}')`
      );
    });
    
    expect(newResults.length).toBe(2);
    expect(newResults.map(r => r.id).sort()).toEqual([PROD1_ID, PROD2_ID].sort());
  }, 30000); // 30s timeout for worker
});
