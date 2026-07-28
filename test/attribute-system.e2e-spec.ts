import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AttributeDefinitionsController } from '../src/modules/commerce/catalog/attribute-definitions/attribute-definitions.controller.js';
import { AttributeDefinitionsService } from '../src/modules/commerce/catalog/attribute-definitions/attribute-definitions.service.js';
import { ProductsController } from '../src/modules/commerce/catalog/products.controller.js';
import { ProductsService } from '../src/modules/commerce/catalog/products.service.js';
import { CatalogSearchRepository } from '../src/modules/commerce/catalog/repositories/catalog-search.repository.js';
import { AttributeValidationService } from '../src/modules/commerce/catalog/attribute-definitions/attribute-validation.service.js';
import { TenantPrismaService } from '../src/infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../src/infrastructure/cache/cache.service.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../src/infrastructure/config/config.service.js';
import { AuthGuard } from '../src/security/guards/auth.guard.js';
import { PermissionsGuard } from '../src/security/guards/permissions.guard.js';
import { ProductSearchIndexRepository } from '../src/modules/commerce/search/repositories/product-search-index.repository.js';
import { AppLogger } from '../src/infrastructure/logging/logger.service.js';
import { AttributeType } from '@prisma/client';
import { requestContextStorage } from '../src/common/context/request-context.js';

describe('Attribute System E2E Workflow', () => {
  let app: INestApplication;
  let mockDb: any;
  let mockCache: any;
  let mockTx: any;

  beforeAll(async () => {
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      sadd: jest.fn().mockResolvedValue(1),
      invalidateKeys: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };

    mockTx = {
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-123', tenantId: 'tenant-A' }),
      },
      category: {
        findFirst: jest.fn().mockImplementation((args) => {
          if (args.where.id === 'cat-invalid') return Promise.resolve(null);
          return Promise.resolve({ id: args.where.id || 'cat-123', tenantId: args.where.tenantId || 'tenant-A' });
        }),
        findMany: jest.fn().mockResolvedValue([{ id: 'cat-123' }]),
      },
      attributeDefinition: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'def-new', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'def-updated', ...args.data })),
        delete: jest.fn().mockResolvedValue({ success: true }),
        findFirst: jest.fn().mockImplementation((args) => {
          if (args.where.name === 'duplicate_key') {
            return Promise.resolve({ id: 'def-dup', name: 'duplicate_key', tenantId: args.where.tenantId });
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn().mockImplementation((args) => {
          const defs = [
            {
              id: 'def-color',
              name: 'color',
              type: AttributeType.color,
              options: [{ value: '#FF0000', labelTranslations: { en: 'Red', ar: 'أحمر' } }],
              isRequired: true,
              isVariantAxis: true,
              categoryId: null,
              tenantId: args.where.tenantId,
            },
            {
              id: 'def-size',
              name: 'size',
              type: AttributeType.select,
              options: [{ value: 'M', labelTranslations: { en: 'Medium' } }],
              isRequired: false,
              isVariantAxis: true,
              categoryId: 'cat-123',
              tenantId: args.where.tenantId,
            },
            {
              id: 'def-custom-text',
              name: 'material',
              type: AttributeType.text,
              isRequired: false,
              isVariantAxis: false,
              categoryId: null,
              tenantId: args.where.tenantId,
            },
            {
              id: 'def-custom-num',
              name: 'weight_g',
              type: AttributeType.number,
              isRequired: false,
              isVariantAxis: false,
              categoryId: null,
              tenantId: args.where.tenantId,
            },
            {
              id: 'def-custom-bool',
              name: 'is_waterproof',
              type: AttributeType.boolean,
              isRequired: false,
              isVariantAxis: true, // true so that it acts as a variant attribute when creating variants
              categoryId: null,
              tenantId: args.where.tenantId,
            }
          ];
          return Promise.resolve(defs.filter(d => d.tenantId === args.where.tenantId));
        }),
      },
      product: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'prod-new', ...args.data })),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'prod-updated', ...args.data })),
        findFirst: jest.fn().mockImplementation((args) => {
          if (args.where.id === 'prod-invalid') return Promise.resolve(null);
          return Promise.resolve({
            id: args.where.id || 'prod-123',
            tenantId: 'tenant-A',
            categories: [{ categoryId: 'cat-123' }],
            attributes: {},
            variants: [],
          });
        }),
        findMany: jest.fn().mockImplementation((args) => {
          const products = [
            {
              id: 'prod-123',
              tenantId: 'tenant-A',
              variants: [
                {
                  id: 'var-123',
                  sku: 'VELO-RED-M',
                  attributes: { color: 'Red', size: 'M' },
                  price: 100,
                }
              ]
            }
          ];
          return Promise.resolve(products.filter(p => p.tenantId === args.where.tenantId));
        }),
        count: jest.fn().mockResolvedValue(1),
      },
      productVariant: {
        create: jest.fn().mockImplementation((args) => Promise.resolve({ id: 'var-new', ...args.data })),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      categoriesOnProducts: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      }
    };

    mockDb = {
      exec: jest.fn().mockImplementation((cb) => cb(mockTx)),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [AttributeDefinitionsController, ProductsController],
      providers: [
        AttributeDefinitionsService,
        AttributeValidationService,
        ProductsService,
        CatalogSearchRepository,
        {
          provide: ProductSearchIndexRepository,
          useValue: {
            refreshProductVector: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: AppLogger, useValue: { error: jest.fn(), log: jest.fn(), warn: jest.fn() } },
        { provide: TenantPrismaService, useValue: mockDb },
        { provide: CacheService, useValue: mockCache },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(async (token: string) => {
              if (token === 'tenant-A-token') {
                return { sub: 'owner-A', tenantId: 'tenant-A', role: 'tenant_owner' };
              }
              if (token === 'tenant-B-token') {
                return { sub: 'owner-B', tenantId: 'tenant-B', role: 'tenant_owner' };
              }
              throw new Error('Invalid token');
            }),
          },
        },
        { provide: ConfigService, useValue: { jwtSecret: 'test-secret' } },
        AuthGuard,
        PermissionsGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    
    app.use((req: any, res: any, next: any) => {
      const auth = req.headers['authorization'] || '';
      let tenantId = 'global';
      if (auth.includes('tenant-A-token')) {
        tenantId = 'tenant-A';
      } else if (auth.includes('tenant-B-token')) {
        tenantId = 'tenant-B';
      }
      
      requestContextStorage.run({
        tenantId,
        requestId: 'e2e-req',
        correlationId: 'e2e-corr',
        clientIp: '127.0.0.1',
        userAgent: 'e2e-agent',
      }, () => {
        next();
      });
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates global attribute definitions of different types for tenant-A', async () => {
    const definitions = [
      {
        name: 'color',
        labelTranslations: { en: 'Color', ar: 'اللون' },
        type: AttributeType.color,
        options: [{ value: '#FF0000', labelTranslations: { en: 'Red', ar: 'أحمر' } }],
        isRequired: true,
        isVariantAxis: true,
      },
      {
        name: 'material',
        labelTranslations: { en: 'Material' },
        type: AttributeType.text,
        isRequired: false,
        isVariantAxis: false,
      },
      {
        name: 'weight_g',
        labelTranslations: { en: 'Weight' },
        type: AttributeType.number,
        isRequired: false,
        isVariantAxis: false,
      },
      {
        name: 'is_waterproof',
        labelTranslations: { en: 'Waterproof' },
        type: AttributeType.boolean,
        isRequired: false,
        isVariantAxis: true,
      }
    ];

    for (const def of definitions) {
      await request(app.getHttpServer())
        .post('/attribute-definitions')
        .set('Authorization', 'Bearer tenant-A-token')
        .send(def)
        .expect(201);
    }
  });

  it('creates category-scoped attribute definitions', async () => {
    const categoryScoped = {
      name: 'size',
      labelTranslations: { en: 'Size' },
      type: AttributeType.select,
      options: [{ value: 'M', labelTranslations: { en: 'Medium' } }],
      isRequired: false,
      isVariantAxis: true,
      categoryId: 'cat-123',
    };

    const res = await request(app.getHttpServer())
      .post('/attribute-definitions')
      .set('Authorization', 'Bearer tenant-A-token')
      .send(categoryScoped)
      .expect(201);

    expect(res.body.categoryId).toBe('cat-123');
  });

  it('creates a product with valid category-scoped specifications', async () => {
    const validProduct = {
      storeId: 'store-123',
      titleTranslations: { en: 'Velo Tee' },
      categoryIds: ['cat-123'],
      attributes: {
        material: '100% Cotton',
        weight_g: 150,
        is_waterproof: false,
      }
    };

    const res = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', 'Bearer tenant-A-token')
      .send(validProduct)
      .expect(201);

    expect(res.body.id).toBe('prod-new');
  });

  it('rejects variant creation with missing required attributes', async () => {
    const invalidVariant = {
      sku: 'VELO-M',
      price: 150,
      attributes: {
        size: 'M',
      }
    };

    const res = await request(app.getHttpServer())
      .post('/products/prod-123/variants')
      .set('Authorization', 'Bearer tenant-A-token')
      .send(invalidVariant)
      .expect(400);

    expect(res.body.message).toContain('Required attribute "color" is missing');
  });

  it('rejects variant creation with invalid select options', async () => {
    const invalidVariant = {
      sku: 'VELO-RED-XXL',
      price: 150,
      attributes: {
        color: '#FF0000',
        size: 'XXL',
      }
    };

    await request(app.getHttpServer())
      .post('/products/prod-123/variants')
      .set('Authorization', 'Bearer tenant-A-token')
      .send(invalidVariant)
      .expect(400);
  });

  it('rejects variant creation with wrong type (boolean)', async () => {
    const invalidVariant = {
      sku: 'VELO-RED-M',
      price: 150,
      attributes: {
        color: '#FF0000',
        size: 'M',
        is_waterproof: 'yes_please',
      }
    };

    await request(app.getHttpServer())
      .post('/products/prod-123/variants')
      .set('Authorization', 'Bearer tenant-A-token')
      .send(invalidVariant)
      .expect(400);
  });

  it('generates a variant matrix for product based on valid options', async () => {
    const matrixPayload = {
      baseSku: 'VELO-TEE',
      basePrice: 99.9,
      options: {
        color: ['#FF0000'],
        size: ['M']
      }
    };

    const res = await request(app.getHttpServer())
      .post('/products/prod-123/variants/matrix')
      .set('Authorization', 'Bearer tenant-A-token')
      .send(matrixPayload)
      .expect(201);

    expect(res.body).toBeInstanceOf(Array);
  });

  it('filters products using normalized storefront attribute keys', async () => {
    const res = await request(app.getHttpServer())
      .get('/products?attributes[color]=Red')
      .set('Authorization', 'Bearer tenant-A-token')
      .expect(200);

    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('enforces tenant isolation bounds for attribute definitions', async () => {
    const defForB = {
      name: 'color',
      labelTranslations: { en: 'Color' },
      type: AttributeType.color,
      options: [{ value: '#000000', labelTranslations: { en: 'Black' } }],
    };

    await request(app.getHttpServer())
      .post('/attribute-definitions')
      .set('Authorization', 'Bearer tenant-B-token')
      .send(defForB)
      .expect(201);

    mockTx.attributeDefinition.findMany.mockImplementationOnce((args) => {
      expect(args.where.tenantId).toBe('tenant-B');
      return Promise.resolve([]);
    });

    const listRes = await request(app.getHttpServer())
      .get('/attribute-definitions')
      .set('Authorization', 'Bearer tenant-B-token')
      .expect(200);

    expect(listRes.body).toHaveLength(0);
  });
});
