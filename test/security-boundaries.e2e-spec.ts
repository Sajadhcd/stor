import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PaymentsController } from '../src/modules/commerce/payments/payments.controller.js';
import { PaymentsService } from '../src/modules/commerce/payments/payments.service.js';
import { TenantAdminController } from '../src/modules/platform-admin/tenants/tenant-admin.controller.js';
import { TenantAdminService } from '../src/modules/platform-admin/tenants/tenant-admin.service.js';
import { AuthGuard } from '../src/security/guards/auth.guard.js';
import { PermissionsGuard } from '../src/security/guards/permissions.guard.js';
import { ConfigService } from '../src/infrastructure/config/config.service.js';

describe('HTTP authorization boundaries', () => {
  let app: INestApplication;
  const payments = {
    listPayments: jest.fn().mockResolvedValue({ data: [] }),
    refundPayment: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'REFUNDED' }),
    processWebhook: jest.fn().mockResolvedValue({ success: true }),
  };
  const tenants = {
    findAll: jest.fn().mockResolvedValue({ data: [] }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController, TenantAdminController],
      providers: [
        AuthGuard,
        PermissionsGuard,
        { provide: PaymentsService, useValue: payments },
        { provide: TenantAdminService, useValue: tenants },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(async (token: string) => ({
              sub: 'user-1',
              tenantId: '11111111-1111-4111-8111-111111111111',
              role: token === 'platform-admin' ? 'platform_admin' : 'tenant_owner',
            })),
          },
        },
        { provide: ConfigService, useValue: { jwtSecret: 'test-secret' } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated payment refunds', async () => {
    await request(app.getHttpServer())
      .post('/payments/11111111-1111-4111-8111-111111111111/refund')
      .expect(401);
    expect(payments.refundPayment).not.toHaveBeenCalled();
  });

  it('keeps signed provider webhooks public', async () => {
    await request(app.getHttpServer())
      .post('/payments/webhooks/qicard')
      .send({ eventId: 'evt-1' })
      .expect(201);
    expect(payments.processWebhook).toHaveBeenCalled();
  });

  it('denies platform APIs to tenant owners', async () => {
    await request(app.getHttpServer())
      .get('/platform/tenants')
      .set('Authorization', 'Bearer tenant-owner')
      .expect(403);
  });

  it('allows platform APIs to platform administrators', async () => {
    await request(app.getHttpServer())
      .get('/platform/tenants')
      .set('Authorization', 'Bearer platform-admin')
      .expect(200);
  });
});
