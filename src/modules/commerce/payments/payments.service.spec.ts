import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { WebhookSecurityService } from './security/webhook-security.service.js';
import { PaymentEventPublisher } from './events/payment-event-publisher.service.js';
import { PaymentGatewayStrategy } from './strategies/payment-gateway-strategy.interface.js';
import { MockPaymentStrategy } from './strategies/mock-payment.strategy.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';

interface MockPayment {
  id: string;
  tenantId: string;
  storeId: string | null;
  orderId: string;
  provider: string;
  paymentReference: string | null;
  externalTransactionId: string | null;
  transactionId: string | null;
  amount: number;
  currency: string;
  status: string;
  failureReason?: string | null;
  metadata?: Record<string, unknown> | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const createMockPayment = (overrides?: Partial<MockPayment>): MockPayment => ({
  id: 'pay-123',
  tenantId: 'global',
  storeId: 'store-123',
  orderId: 'ord-123',
  provider: 'mock',
  paymentReference: 'MOCK-ORD123-A1B2C3',
  externalTransactionId: 'TX-MOCK-123',
  transactionId: 'TX-MOCK-123',
  amount: 100,
  currency: 'USD',
  status: 'PENDING',
  failureReason: null,
  metadata: null,
  retryCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

type TxCallback<T> = (tx: MockPrismaTx) => Promise<T>;

interface MockPrismaTx {
  payment: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  order: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  paymentWebhookEvent: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
}

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockWebhookSecurityService: jest.Mocked<WebhookSecurityService>;
  let mockEventPublisher: jest.Mocked<PaymentEventPublisher>;
  let mockStrategyRegistry: Map<string, PaymentGatewayStrategy>;
  let mockTx: MockPrismaTx;
  let mockTenantPrismaService: { exec: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    mockWebhookSecurityService = {
      verifyAndProtect: jest.fn().mockResolvedValue({
        valid: true,
        eventId: 'evt-123',
        provider: 'mock',
      }),
    } as unknown as jest.Mocked<WebhookSecurityService>;

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<PaymentEventPublisher>;

    const mockStrategy = new MockPaymentStrategy();
    mockStrategyRegistry = new Map<string, PaymentGatewayStrategy>();
    mockStrategyRegistry.set('mock', mockStrategy);

    const defaultPayment = createMockPayment();

    mockTx = {
      payment: {
        findFirst: jest.fn().mockResolvedValue(defaultPayment),
        findMany: jest.fn().mockResolvedValue([defaultPayment]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(defaultPayment),
        update: jest.fn().mockResolvedValue(defaultPayment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ord-123', tenantId: 'global', storeId: 'store-123', currency: 'USD' }),
        update: jest.fn().mockResolvedValue({ id: 'ord-123', status: 'PAID' }),
      },
      paymentWebhookEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'we-1', eventId: 'evt-123' }),
      },
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: WebhookSecurityService, useValue: mockWebhookSecurityService },
        { provide: 'PAYMENT_STRATEGY_REGISTRY', useValue: mockStrategyRegistry },
        { provide: PaymentEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent via strategy and publish PaymentCreated event', async () => {
      mockTx.payment.findFirst.mockResolvedValueOnce(null); // No existing active payment

      const payment = await service.createPaymentIntent({
        orderId: 'ord-123',
        provider: 'mock',
        amount: 100,
        currency: 'USD',
      });

      expect(payment.id).toBe('pay-123');
      expect(mockTx.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'ord-123',
            provider: 'mock',
            amount: 100,
            status: 'PENDING',
          }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PaymentCreated', orderId: 'ord-123' }),
      );
    });

    it('should return existing pending payment if available for idempotency', async () => {
      const existing = createMockPayment({ status: 'PENDING' });
      mockTx.payment.findFirst.mockResolvedValueOnce(existing);

      const payment = await service.createPaymentIntent({
        orderId: 'ord-123',
        provider: 'mock',
        amount: 100,
      });

      expect(payment).toEqual(existing);
      expect(mockTx.payment.create).not.toHaveBeenCalled();
    });
  });

  describe('confirmPayment', () => {
    it('should verify payment and update payment & order status to PAID on success', async () => {
      const paidPayment = createMockPayment({ status: 'PAID' });
      mockTx.payment.update.mockResolvedValueOnce(paidPayment);

      const result = await service.confirmPayment('pay-123', { externalTransactionId: 'TX-MOCK-123' });

      expect(result.status).toBe('PAID');
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { status: 'PAID', paymentStatus: 'PAID' },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PaymentSucceeded' }),
      );
    });
  });

  describe('retryPayment', () => {
    it('should increment retryCount and set status to PENDING', async () => {
      const payment = createMockPayment({ retryCount: 1 });
      mockTx.payment.findFirst.mockResolvedValueOnce(payment);

      await service.retryPayment('pay-123');

      expect(mockTx.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            retryCount: 2,
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should throw BadRequestException when retry limit of 3 is reached', async () => {
      const payment = createMockPayment({ retryCount: 3 });
      mockTx.payment.findFirst.mockResolvedValueOnce(payment);

      await expect(service.retryPayment('pay-123')).rejects.toThrow(BadRequestException);
    });
  });

  describe('refundPayment', () => {
    it('claims the refund before calling the provider and finalizes a full refund', async () => {
      const paid = createMockPayment({ status: 'PAID', metadata: {} });
      const refunded = createMockPayment({ status: 'REFUNDED', metadata: { refundedAmount: 100 } });
      mockTx.payment.findFirst.mockResolvedValueOnce(paid);
      mockTx.payment.update.mockResolvedValueOnce(refunded);
      const strategy = mockStrategyRegistry.get('mock')!;
      const refundSpy = jest.spyOn(strategy, 'refundPayment');

      const result = await service.refundPayment('pay-123', { amount: 100, reason: 'Damaged' });

      expect(mockTx.payment.updateMany).toHaveBeenCalledWith({
        where: { id: 'pay-123', tenantId: 'global', status: 'PAID' },
        data: { status: 'REFUNDING' },
      });
      expect(refundSpy).toHaveBeenCalledWith('MOCK-ORD123-A1B2C3', 100, 'Damaged');
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
      });
      expect(result.status).toBe('REFUNDED');
    });
  });

  describe('processWebhook', () => {
    it('should prevent replay attack when duplicate webhook eventId is received', async () => {
      mockTx.paymentWebhookEvent.findFirst.mockResolvedValueOnce({ id: 'we-1', eventId: 'evt-123' });

      const res = await service.processWebhook('mock', { orderId: 'ord-123', status: 'paid' }, 'sig', 'ts');

      expect(res).toEqual(expect.objectContaining({ message: expect.stringContaining('Duplicate webhook event ignored') }));
      expect(mockTx.order.update).not.toHaveBeenCalled();
    });
  });
});
