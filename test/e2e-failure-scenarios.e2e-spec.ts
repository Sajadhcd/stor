import { Test, TestingModule } from '@nestjs/testing';
import { TenantPrismaService } from '../src/infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../src/infrastructure/cache/cache.service.js';
import { OrdersService } from '../src/modules/commerce/sales/orders.service.js';
import { PaymentsService } from '../src/modules/commerce/payments/payments.service.js';
import { FulfillmentService } from '../src/modules/commerce/fulfillment/fulfillment.service.js';
import { ShippingService } from '../src/modules/commerce/shipping/shipping.service.js';
import { OrderNumberGenerator } from '../src/modules/commerce/sales/services/order-number-generator.service.js';
import { OrderEventPublisher } from '../src/modules/commerce/sales/events/order-event-publisher.service.js';
import { PaymentEventPublisher } from '../src/modules/commerce/payments/events/payment-event-publisher.service.js';
import { FulfillmentEventPublisher } from '../src/modules/commerce/fulfillment/events/fulfillment-event-publisher.service.js';
import { ShippingEventPublisher } from '../src/modules/commerce/shipping/events/shipping-event-publisher.service.js';
import { WebhookSecurityService } from '../src/modules/commerce/payments/security/webhook-security.service.js';
import { MockPaymentStrategy } from '../src/modules/commerce/payments/strategies/mock-payment.strategy.js';
import { MockCarrierStrategy } from '../src/modules/commerce/shipping/strategies/mock-carrier.strategy.js';
import { DefaultShippingCostCalculator } from '../src/modules/commerce/shipping/calculators/default-shipping-cost.calculator.js';
import { AppLogger } from '../src/infrastructure/logging/logger.service.js';
import { OrderStatus, PaymentStatus, FulfillmentStatus, ShipmentStatus } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

type TxCallback<T> = (tx: Record<string, any>) => Promise<T>;

describe('Sprint 4.0 End-to-End Failure & Edge Scenarios', () => {
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;
  let fulfillmentService: FulfillmentService;
  let shippingService: ShippingService;
  let mockTx: Record<string, any>;
  let mockTenantPrismaService: { exec: jest.Mock };

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockWebhookSecurity = {
      verifyAndProtect: jest.fn().mockResolvedValue({
        valid: true,
        eventId: 'evt-dup-1',
        provider: 'mock',
      }),
    };

    const mockLogger = { log: jest.fn() };

    mockTx = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ord-fail-1',
          tenantId: 'global',
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PENDING,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          notes: '',
          items: [{ variantId: 'var-1', quantity: 5 }],
        }),
        update: jest.fn().mockResolvedValue({
          id: 'ord-fail-1',
          status: OrderStatus.CANCELLED,
        }),
      },
      checkout: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'chk-exp-1',
          tenantId: 'global',
          expiresAt: new Date(Date.now() - 10000), // Expired
        }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pay-retry-1',
          tenantId: 'global',
          orderId: 'ord-fail-1',
          provider: 'mock',
          paymentReference: 'MOCK-REF-1',
          amount: 100,
          currency: 'USD',
          status: 'FAILED',
          retryCount: 3, // Max limit reached
        }),
        update: jest.fn().mockResolvedValue({ id: 'pay-retry-1', status: 'REFUNDED' }),
      },
      paymentWebhookEvent: {
        findFirst: jest.fn().mockResolvedValue({ id: 'we-existing-1', eventId: 'evt-dup-1' }),
      },
      shipment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ship-fail-1',
          tenantId: 'global',
          orderId: 'ord-fail-1',
          carrier: 'mock',
          trackingNumber: 'MOCK-TRK-FAIL',
          status: ShipmentStatus.PREPARED,
        }),
        update: jest.fn().mockResolvedValue({ id: 'ship-fail-1', status: ShipmentStatus.CANCELLED }),
      },
      shipmentTrackingHistory: { create: jest.fn().mockResolvedValue({ id: 'th-1' }) },
      orderTimeline: { create: jest.fn().mockResolvedValue({ id: 'tl-1' }) },
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([{ quantityPhysical: 2, quantityReserved: 0 }]), // Shortage
        findFirst: jest.fn().mockResolvedValue({ quantityPhysical: 2, quantityReserved: 0 }),
        update: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true }) },
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const mockPaymentStrategy = new MockPaymentStrategy();
    const paymentRegistry = new Map();
    paymentRegistry.set('mock', mockPaymentStrategy);

    const mockCarrierStrategy = new MockCarrierStrategy();
    const carrierRegistry = new Map();
    carrierRegistry.set('mock', mockCarrierStrategy);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        PaymentsService,
        FulfillmentService,
        ShippingService,
        OrderNumberGenerator,
        OrderEventPublisher,
        PaymentEventPublisher,
        FulfillmentEventPublisher,
        ShippingEventPublisher,
        DefaultShippingCostCalculator,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: WebhookSecurityService, useValue: mockWebhookSecurity },
        { provide: 'PAYMENT_STRATEGY_REGISTRY', useValue: paymentRegistry },
        { provide: 'CARRIER_STRATEGY_REGISTRY', useValue: carrierRegistry },
        { provide: 'SHIPPING_COST_CALCULATOR', useClass: DefaultShippingCostCalculator },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    ordersService = module.get<OrdersService>(OrdersService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
    fulfillmentService = module.get<FulfillmentService>(FulfillmentService);
    shippingService = module.get<ShippingService>(ShippingService);
  });

  it('should reject payment retry when maximum retry count of 3 is reached', async () => {
    await expect(paymentsService.retryPayment('pay-retry-1')).rejects.toThrow(BadRequestException);
  });

  it('should prevent replay attack by ignoring duplicate webhook eventId', async () => {
    const res = await paymentsService.processWebhook('mock', { orderId: 'ord-fail-1', status: 'paid' }, 'sig', 'ts');
    expect(res).toHaveProperty('message');
    expect((res as any).message).toContain('Duplicate webhook event ignored');
  });

  it('should reject creating order from expired checkout session', async () => {
    await expect(ordersService.createOrderFromCheckout('chk-exp-1')).rejects.toThrow('Checkout session has expired');
  });

  it('should reject inventory reservation when available physical stock is insufficient', async () => {
    await expect(fulfillmentService.reserveInventory('ord-fail-1', 'wh-1')).rejects.toThrow(BadRequestException);
  });

  it('should process order cancellation and update status to CANCELLED', async () => {
    const res = await ordersService.cancelOrder('ord-fail-1', 'Out of stock');
    expect(res.status).toBe(OrderStatus.CANCELLED);
  });

  it('should process shipment cancellation', async () => {
    const res = await shippingService.cancelShipment('ship-fail-1');
    expect(res.status).toBe(ShipmentStatus.CANCELLED);
  });

  it('should reject refunding a failed payment', async () => {
    await expect(
      paymentsService.refundPayment('pay-retry-1', { amount: 100, reason: 'Damaged item' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should enforce state machine transition rules and reject invalid status update', async () => {
    const deliveredOrder = {
      id: 'ord-delivered-1',
      tenantId: 'global',
      status: OrderStatus.DELIVERED,
    };
    mockTx.order.findFirst.mockResolvedValueOnce(deliveredOrder);

    await expect(ordersService.updateOrderStatus('ord-delivered-1', OrderStatus.PROCESSING)).rejects.toThrow(BadRequestException);
  });
});
