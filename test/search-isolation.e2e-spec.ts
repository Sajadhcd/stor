import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PostgresFtsProvider } from '../src/modules/commerce/search/providers/postgres-fts.provider.js';
import { TenantPrismaService } from '../src/infrastructure/database/tenant-prisma.service.js';
import { ConfigService } from '../src/infrastructure/config/config.service.js';
import { requestContextStorage } from '../src/common/context/request-context.js';

describe('Search Isolation E2E', () => {
  let adminPrisma: PrismaClient;
  let tenantPrismaService: TenantPrismaService;
  let provider: PostgresFtsProvider;

  const tenantAId = randomUUID();
  const tenantBId = randomUUID();
  const storeAId = randomUUID();
  const storeBId = randomUUID();
  const productAId = randomUUID();
  const productBId = randomUUID();
  
  const uniqueSearchTerm = `UniqueSearchTerm${randomUUID().substring(0, 8)}`;

  beforeAll(async () => {
    adminPrisma = new PrismaClient();
    
    // Create Tenants
    await adminPrisma.tenant.createMany({
      data: [
        { id: tenantAId, name: 'Tenant A', subdomain: `tenant-a-${randomUUID().substring(0, 8)}` },
        { id: tenantBId, name: 'Tenant B', subdomain: `tenant-b-${randomUUID().substring(0, 8)}` },
      ]
    });

    // Create Stores
    await adminPrisma.store.createMany({
      data: [
        { id: storeAId, tenantId: tenantAId, name: 'Store A' },
        { id: storeBId, tenantId: tenantBId, name: 'Store B' },
      ]
    });

    // Create Products with the exact same searchable term but in different tenants
    await adminPrisma.product.createMany({
      data: [
        {
          id: productAId,
          tenantId: tenantAId,
          storeId: storeAId,
          titleTranslations: { ar: `مميز ${uniqueSearchTerm}`, en: 'Product A' },
          isPublished: true,
        },
        {
          id: productBId,
          tenantId: tenantBId,
          storeId: storeBId,
          titleTranslations: { ar: `رائع ${uniqueSearchTerm}`, en: 'Product B' },
          isPublished: true,
        },
      ]
    });

    // Setup provider
    const mockConfig = {
      appDatabaseUrl: process.env.APP_DATABASE_URL || 'postgresql://nexio_app:nAx--aXaRYFt1wszxf_QfUalMpOak5vJDAKh8L1grdIDpqjL@localhost:5432/nexio_commerce?schema=public',
    } as unknown as ConfigService;

    tenantPrismaService = new TenantPrismaService(mockConfig);
    await tenantPrismaService.onModuleInit();
    
    provider = new PostgresFtsProvider(tenantPrismaService);
  });

  afterAll(async () => {
    // Clean up
    if (adminPrisma) {
      await adminPrisma.product.deleteMany({ where: { id: { in: [productAId, productBId] } } });
      await adminPrisma.store.deleteMany({ where: { id: { in: [storeAId, storeBId] } } });
      await adminPrisma.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
      await adminPrisma.auditLog.deleteMany({ where: { rowId: { in: [tenantAId, tenantBId, storeAId, storeBId, productAId, productBId] } } });
      await adminPrisma.$disconnect();
    }
    if (tenantPrismaService) {
      await tenantPrismaService.onModuleDestroy();
    }
  });

  it('should refresh vectors using the tenant-scoped method and enforce isolation', async () => {
    // Refresh vectors for Tenant A
    await requestContextStorage.run(
      { tenantId: tenantAId, requestId: 'test-req', correlationId: 'test-corr' },
      async () => {
        await provider.refreshAllProductVectors(tenantAId);
      }
    );

    // Refresh vectors for Tenant B
    await requestContextStorage.run(
      { tenantId: tenantBId, requestId: 'test-req', correlationId: 'test-corr' },
      async () => {
        await provider.refreshAllProductVectors(tenantBId);
      }
    );

    // Search as Tenant A
    await requestContextStorage.run(
      { tenantId: tenantAId, requestId: 'test-req', correlationId: 'test-corr' },
      async () => {
        const resultA = await provider.search(tenantAId, { query: uniqueSearchTerm });
        
        // Do not filter unexpected results out before asserting
        const matchingIds = resultA.items.map(i => i.id);
        
        // Assert tenant A product is returned
        expect(matchingIds).toContain(productAId);
        
        // Assert tenant B product is not returned
        expect(matchingIds).not.toContain(productBId);
      }
    );
  });
});
