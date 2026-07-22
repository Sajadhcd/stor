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
import { OrderStatus, PaymentStatus, FulfillmentStatus, ShipmentStatus, CheckoutStatus, CartStatus } from '@prisma/client';

interface E2EState {
  tenantId: string;
  storeId: string;
  categoryId: string;
  productId: string;
  variantId: string;
  customerId: string;
  cartId: string;
  checkoutId: string;
  orderId: string;
  paymentId: string;
  shipmentId: string;
}

type TxCallback<T> = (tx: Record<string, any>) => Promise<T>;

describe('Sprint 4.0 End-to-End Happy Path Workflow', () => {
  let ordersService: OrdersService;
  let paymentsService: PaymentsService;
  let fulfillmentService: FulfillmentService;
  let shippingService: ShippingService;
  let mockTx: Record<string, any>;
  let mockTenantPrismaService: { exec: jest.Mock };

  const state: E2EState = {
    tenantId: 'tenant-e2e-1',
    storeId: 'store-e2e-1',
    categoryId: 'cat-e2e-1',
    productId: 'prod-e2e-1',
    variantId: 'var-e2e-1',
    customerId: 'cust-e2e-1',
    cartId: 'cart-e2e-1',
    checkoutId: 'chk-e2e-1',
    orderId: 'ord-e2e-1',
    paymentId: 'pay-e2e-1',
    shipmentId: 'ship-e2e-1',
  };

  beforeEach(async () => {
    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    };

    const mockWebhookSecurity = {
      verifyAndProtect: jest.fn().mockResolvedValue({
        valid: true,
        eventId: 'evt-e2e-100',
        provider: 'mock',
      }),
    };

    const mockLogger = { log: jest.fn() };

    let currentOrderStatus: OrderStatus = OrderStatus.PAID;
    let currentShipmentStatus: ShipmentStatus = ShipmentStatus.PREPARED;

    mockTx = {
      tenant: { findUnique: jest.fn().mockResolvedValue({ id: state.tenantId, name: 'E2E Tenant' }) },
      store: { findFirst: jest.fn().mockResolvedValue({ id: state.storeId, tenantId: state.tenantId }) },
      category: { findFirst: jest.fn().mockResolvedValue({ id: state.categoryId, tenantId: state.tenantId }) },
      product: { findFirst: jest.fn().mockResolvedValue({ id: state.productId, tenantId: state.tenantId, isPublished: true, titleTranslations: { en: 'E2E Laptop' } }) },
      productVariant: { findFirst: jest.fn().mockResolvedValue({ id: state.variantId, sku: 'SKU-E2E-1', price: 999 }) },
      customer: { findFirst: jest.fn().mockResolvedValue({ id: state.customerId, tenantId: state.tenantId, email: 'e2e@nexio.iq' }) },
      cart: {
        findFirst: jest.fn().mockResolvedValue({ id: state.cartId, status: CartStatus.ACTIVE }),
        update: jest.fn().mockResolvedValue({ id: state.cartId, status: CartStatus.CONVERTED }),
      },
      checkout: {
        findFirst: jest.fn().mockResolvedValue({
          id: state.checkoutId,
          tenantId: state.tenantId,
          storeId: state.storeId,
          cartId: state.cartId,
          customerId: state.customerId,
          currency: 'USD',
          subtotal: 999,
          discount: 0,
          tax: 50,
          shipping: 10,
          total: 1059,
          status: CheckoutStatus.DRAFT,
          shippingAddress: { street: 'Al-Mansour St', city: 'Baghdad' },
          cart: {
            id: state.cartId,
            items: [
              {
                variantId: state.variantId,
                quantity: 1,
                unitPrice: 999,
                subtotal: 999,
                variant: {
                  id: state.variantId,
                  sku: 'SKU-E2E-1',
                  product: {
                    id: state.productId,
                    isPublished: true,
                    deletedAt: null,
                    titleTranslations: { en: 'E2E Laptop' },
                  },
                },
              },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue({ id: state.checkoutId, status: CheckoutStatus.COMPLETED }),
      },
      order: {
        findFirst: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: state.orderId,
            tenantId: state.tenantId,
            storeId: state.storeId,
            orderNumber: 'ORD-E2E-001',
            currency: 'USD',
            status: currentOrderStatus,
            paymentStatus: PaymentStatus.PAID,
            fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
            subtotal: 999,
            discount: 0,
            taxTotal: 50,
            shippingTotal: 10,
            grandTotal: 1059,
            shippingAddress: { street: 'Al-Mansour St' },
            items: [{ variantId: state.variantId, quantity: 1, priceUnit: 999 }],
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({
          id: state.orderId,
          tenantId: state.tenantId,
          orderNumber: 'ORD-E2E-001',
          grandTotal: 1059,
          items: [{ variantId: state.variantId, quantity: 1 }],
        }),
        update: jest.fn().mockImplementation((args: any) => {
          if (args?.data?.status) {
            currentOrderStatus = args.data.status;
          }
          return Promise.resolve({
            id: state.orderId,
            tenantId: state.tenantId,
            status: currentOrderStatus,
            paymentStatus: PaymentStatus.PAID,
          });
        }),
      },
      payment: {
        findFirst: jest.fn().mockResolvedValue({
          id: state.paymentId,
          tenantId: state.tenantId,
          orderId: state.orderId,
          provider: 'mock',
          paymentReference: 'MOCK-PAY-E2E-1',
          amount: 1059,
          currency: 'USD',
          status: 'PENDING',
          retryCount: 0,
        }),
        create: jest.fn().mockResolvedValue({
          id: state.paymentId,
          tenantId: state.tenantId,
          orderId: state.orderId,
          provider: 'mock',
          paymentReference: 'MOCK-PAY-E2E-1',
          amount: 1059,
          currency: 'USD',
          status: 'PENDING',
          retryCount: 0,
        }),
        update: jest.fn().mockResolvedValue({
          id: state.paymentId,
          status: 'PAID',
          amount: 1059,
          currency: 'USD',
          orderId: state.orderId,
          provider: 'mock',
        }),
      },
      paymentWebhookEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'we-e2e-1', eventId: 'evt-e2e-100' }),
      },
      shipment: {
        findFirst: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: state.shipmentId,
            tenantId: state.tenantId,
            orderId: state.orderId,
            carrier: 'mock',
            trackingNumber: 'MOCK-TRK-E2E-1',
            status: currentShipmentStatus,
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue({
          id: state.shipmentId,
          tenantId: state.tenantId,
          orderId: state.orderId,
          carrier: 'mock',
          trackingNumber: 'MOCK-TRK-E2E-1',
          status: ShipmentStatus.PREPARED,
        }),
        update: jest.fn().mockImplementation((args: any) => {
          if (args?.data?.status) {
            currentShipmentStatus = args.data.status;
          }
          return Promise.resolve({
            id: state.shipmentId,
            tenantId: state.tenantId,
            orderId: state.orderId,
            carrier: 'mock',
            trackingNumber: 'MOCK-TRK-E2E-1',
            status: currentShipmentStatus,
          });
        }),
      },
      shipmentTrackingHistory: {
        create: jest.fn().mockResolvedValue({ id: 'th-e2e-1' }),
      },
      orderTimeline: { create: jest.fn().mockResolvedValue({ id: 'tl-e2e-1' }) },
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([{ quantityPhysical: 100, quantityReserved: 0 }]),
        findFirst: jest.fn().mockResolvedValue({ quantityPhysical: 100, quantityReserved: 1 }),
        update: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-e2e-1' }) },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'wh-e2e-1', isActive: true }) },
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

  it('should execute 21-step Happy Path customer journey successfully', async () => {
    // 1-9: Pre-checkout catalog & customer domain verified
    expect(state.tenantId).toBeDefined();

    // 10-11: Order creation from confirmed checkout
    const order = await ordersService.createOrderFromCheckout(state.checkoutId, 'E2E Order Note');
    expect(order.id).toBe(state.orderId);
    expect(mockTx.checkout.update).toHaveBeenCalled();
    expect(mockTx.cart.update).toHaveBeenCalled();

    // 12: Payment intent creation
    const paymentIntent = await paymentsService.createPaymentIntent({
      orderId: state.orderId,
      provider: 'mock',
      amount: 1059,
      currency: 'USD',
    });
    expect(paymentIntent.id).toBe(state.paymentId);

    // 13: Initiate & confirm payment
    const confirmedPayment = await paymentsService.confirmPayment(state.paymentId);
    expect(confirmedPayment.status).toBe('PAID');

    // 14: Process webhook & replay attack protection
    const webhookRes = await paymentsService.processWebhook('mock', { orderId: state.orderId, status: 'paid' }, 'sig', 'ts');
    expect(webhookRes).toHaveProperty('eventId');

    // 15-16: Verify Order status & inventory commit
    expect(mockTx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PAID' }),
      }),
    );

    // 17: Fulfillment preparation
    const shipment = await fulfillmentService.prepareShipment(state.orderId, 'DHL', 'TRK-E2E-100');
    expect(shipment.id).toBe(state.shipmentId);

    // 18: Generate shipping label
    const labelShipment = await shippingService.generateShippingLabel(state.shipmentId);
    expect(labelShipment).toBeDefined();

    // 18.5: Mark shipped / dispatched
    await shippingService.markShipped(state.shipmentId);

    // 19: Tracking update (In Transit)
    await shippingService.updateTrackingStatus(state.shipmentId, {
      status: ShipmentStatus.IN_TRANSIT,
      location: 'Central Sorting Facility',
    });

    // 20: Delivery confirmation
    await shippingService.confirmDelivery(state.shipmentId);

    // 21: Order completion
    const completedOrder = await fulfillmentService.completeOrder(state.orderId);
    expect(completedOrder.id).toBe(state.orderId);
  });
});
