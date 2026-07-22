import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { OrderNumberGenerator } from './services/order-number-generator.service.js';
import { OrderEventPublisher } from './events/order-event-publisher.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, FulfillmentStatus, CheckoutStatus, CartStatus } from '@prisma/client';

interface MockOrder {
  id: string;
  tenantId: string;
  storeId: string;
  checkoutId: string | null;
  cartId: string | null;
  customerId: string;
  orderNumber: string;
  currency: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  subtotal: number;
  discount: number;
  taxTotal: number;
  shippingTotal: number;
  grandTotal: number;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown> | null;
  notes?: string | null;
  items: MockOrderItem[];
}

interface MockOrderItem {
  id: string;
  tenantId: string;
  orderId: string;
  productId: string | null;
  variantId: string;
  sku: string | null;
  productName: string | null;
  variantName: string | null;
  priceUnit: number;
  quantity: number;
  taxRate: number;
  subtotal: number;
}

const createMockOrder = (overrides?: Partial<MockOrder>): MockOrder => ({
  id: 'ord-123',
  tenantId: 'global',
  storeId: 'store-123',
  checkoutId: 'chk-123',
  cartId: 'cart-123',
  customerId: 'cust-123',
  orderNumber: 'ORD-20260722-A1B2C3',
  currency: 'USD',
  status: OrderStatus.CONFIRMED,
  paymentStatus: PaymentStatus.PENDING,
  fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
  subtotal: 100,
  discount: 0,
  taxTotal: 15,
  shippingTotal: 10,
  grandTotal: 125,
  shippingAddress: { street: 'Main St', city: 'Baghdad' },
  billingAddress: { street: 'Main St', city: 'Baghdad' },
  notes: 'First order',
  items: [
    {
      id: 'item-1',
      tenantId: 'global',
      orderId: 'ord-123',
      productId: 'prod-1',
      variantId: 'var-1',
      sku: 'SKU-001',
      productName: 'Test Product',
      variantName: 'SKU-001',
      priceUnit: 50,
      quantity: 2,
      taxRate: 15,
      subtotal: 100,
    },
  ],
  ...overrides,
});

type TxCallback<T> = (tx: MockPrismaTx) => Promise<T>;

interface MockPrismaTx {
  order: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  checkout: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  cart: {
    update: jest.Mock;
  };
  customer: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  store: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  productVariant: {
    findFirst: jest.Mock;
  };
  stockLevel: {
    findMany?: jest.Mock;
    update: jest.Mock;
  };
  stockMovement: {
    create: jest.Mock;
  };
  orderTimeline: {
    create: jest.Mock;
  };
  warehouse: {
    findFirst: jest.Mock;
  };
  $queryRaw: jest.Mock;
}

describe('OrdersService', () => {
  let service: OrdersService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockOrderNumberGenerator: jest.Mocked<OrderNumberGenerator>;
  let mockEventPublisher: jest.Mocked<OrderEventPublisher>;
  let mockTx: MockPrismaTx;
  let mockTenantPrismaService: { exec: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    mockOrderNumberGenerator = {
      generateOrderNumber: jest.fn().mockReturnValue('ORD-20260722-A1B2C3'),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderEventPublisher>;

    const defaultOrder = createMockOrder();

    mockTx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(defaultOrder),
        findFirst: jest.fn().mockResolvedValue(defaultOrder),
        findMany: jest.fn().mockResolvedValue([defaultOrder]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(defaultOrder),
        update: jest.fn().mockResolvedValue(defaultOrder),
      },
      checkout: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'chk-123',
          tenantId: 'global',
          storeId: 'store-123',
          cartId: 'cart-123',
          customerId: 'cust-123',
          currency: 'USD',
          subtotal: 100,
          discount: 0,
          tax: 15,
          shipping: 10,
          total: 125,
          status: CheckoutStatus.DRAFT,
          expiresAt: new Date(Date.now() + 100000),
          shippingAddress: { street: 'Main St' },
          cart: {
            id: 'cart-123',
            items: [
              {
                variantId: 'var-1',
                quantity: 2,
                unitPrice: 50,
                subtotal: 100,
                variant: {
                  id: 'var-1',
                  sku: 'SKU-001',
                  price: 50,
                  product: {
                    id: 'prod-1',
                    tenantId: 'global',
                    storeId: 'store-123',
                    isPublished: true,
                    deletedAt: null,
                    titleTranslations: { en: 'Test Product' },
                  },
                },
              },
            ],
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'chk-123', status: CheckoutStatus.COMPLETED }),
      },
      cart: {
        update: jest.fn().mockResolvedValue({ id: 'cart-123', status: CartStatus.CONVERTED }),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cust-123', tenantId: 'global' }),
        create: jest.fn().mockResolvedValue({ id: 'cust-123', tenantId: 'global' }),
      },
      store: {
        findFirst: jest.fn().mockResolvedValue({ id: 'store-123', tenantId: 'global' }),
        create: jest.fn().mockResolvedValue({ id: 'store-123', tenantId: 'global' }),
      },
      productVariant: {
        findFirst: jest.fn().mockResolvedValue({ id: 'var-1' }),
      },
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([{ quantityPhysical: 100, quantityReserved: 0 }]),
        update: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
      orderTimeline: {
        create: jest.fn().mockResolvedValue({ id: 'tl-1' }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ quantity_physical: 100, quantity_reserved: 0 }]),
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: OrderNumberGenerator, useValue: mockOrderNumberGenerator },
        { provide: OrderEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createOrderFromCheckout', () => {
    it('should create order from confirmed checkout, snapshot product data, and publish OrderCreated event', async () => {
      const order = await service.createOrderFromCheckout('chk-123', 'Please handle with care');

      expect(order.id).toBe('ord-123');
      expect(mockOrderNumberGenerator.generateOrderNumber).toHaveBeenCalled();
      expect(mockTx.checkout.update).toHaveBeenCalledWith({
        where: { id: 'chk-123' },
        data: { status: CheckoutStatus.COMPLETED },
      });
      expect(mockTx.cart.update).toHaveBeenCalledWith({
        where: { id: 'cart-123' },
        data: { status: CartStatus.CONVERTED },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrderCreated', orderNumber: 'ORD-20260722-A1B2C3' }),
      );
      expect(mockCacheService.invalidatePattern).toHaveBeenCalledWith('tenant:global:order:ord-123');
    });

    it('should throw NotFoundException if checkout is missing', async () => {
      mockTx.checkout.findFirst.mockResolvedValueOnce(null);

      await expect(service.createOrderFromCheckout('invalid-chk')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if checkout is expired', async () => {
      mockTx.checkout.findFirst.mockResolvedValueOnce({
        id: 'chk-123',
        expiresAt: new Date(Date.now() - 10000),
      });

      await expect(service.createOrderFromCheckout('chk-123')).rejects.toThrow('Checkout session has expired');
    });
  });

  describe('getOrder', () => {
    it('should return cached order on cache hit without database query', async () => {
      const order = createMockOrder();
      mockCacheService.get.mockResolvedValueOnce(order);

      const result = await service.getOrder('ord-123');

      expect(result).toEqual(order);
      expect(mockTenantPrismaService.exec).not.toHaveBeenCalled();
    });

    it('should query database, populate cache, and return order on cache miss', async () => {
      const order = createMockOrder();
      mockTx.order.findFirst.mockResolvedValueOnce(order);

      const result = await service.getOrder('ord-123');

      expect(result).toEqual(order);
      expect(mockCacheService.set).toHaveBeenCalledWith('tenant:global:order:ord-123', order, 300);
    });
  });

  describe('updateOrderStatus & updatePaymentStatus & updateFulfillmentStatus', () => {
    it('should update status and deduct inventory on transition to PROCESSING', async () => {
      const orderPaid = createMockOrder({ status: OrderStatus.PAID });
      mockTx.order.findFirst.mockResolvedValueOnce(orderPaid);

      await service.updateOrderStatus('ord-123', OrderStatus.PROCESSING, 'wh-1');

      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: OrderStatus.PROCESSING },
        }),
      );
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException on invalid status transition', async () => {
      const orderDelivered = createMockOrder({ status: OrderStatus.DELIVERED });
      mockTx.order.findFirst.mockResolvedValueOnce(orderDelivered);

      await expect(service.updateOrderStatus('ord-123', OrderStatus.PROCESSING)).rejects.toThrow(BadRequestException);
    });

    it('should update payment status and publish PaymentStatusUpdated event', async () => {
      await service.updatePaymentStatus('ord-123', PaymentStatus.PAID);

      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { paymentStatus: PaymentStatus.PAID },
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'PaymentStatusUpdated' }),
      );
    });

    it('should update fulfillment status and publish FulfillmentStatusUpdated event', async () => {
      await service.updateFulfillmentStatus('ord-123', FulfillmentStatus.FULFILLED);

      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { fulfillmentStatus: FulfillmentStatus.FULFILLED },
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'FulfillmentStatusUpdated' }),
      );
    });
  });

  describe('cancelOrder', () => {
    it('should cancel active order and publish OrderCancelled event', async () => {
      await service.cancelOrder('ord-123', 'Customer requested');

      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.CANCELLED }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrderCancelled' }),
      );
    });

    it('should throw BadRequestException when trying to cancel an already SHIPPED or DELIVERED order', async () => {
      const shippedOrder = createMockOrder({ status: OrderStatus.SHIPPED });
      mockTx.order.findFirst.mockResolvedValueOnce(shippedOrder);

      await expect(service.cancelOrder('ord-123')).rejects.toThrow('Cannot cancel order in status');
    });
  });
});
