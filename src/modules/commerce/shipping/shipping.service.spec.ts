import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService } from './shipping.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { CarrierStrategy } from './strategies/carrier-strategy.interface.js';
import { MockCarrierStrategy } from './strategies/mock-carrier.strategy.js';
import { ShippingCostCalculator } from './calculators/shipping-cost-calculator.interface.js';
import { DefaultShippingCostCalculator } from './calculators/default-shipping-cost.calculator.js';
import { ShippingEventPublisher } from './events/shipping-event-publisher.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ShipmentStatus, OrderStatus } from '@prisma/client';

interface MockShipment {
  id: string;
  tenantId: string;
  storeId: string | null;
  orderId: string;
  fulfillmentId: string | null;
  carrier: string;
  serviceLevel: string | null;
  trackingNumber: string;
  shippingLabelReference: string | null;
  estimatedDeliveryDate: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  status: ShipmentStatus;
  shippingCost: number;
  history: Array<{ id: string; status: string; carrierStatus: string | null; location: string | null }>;
}

const createMockShipment = (overrides?: Partial<MockShipment>): MockShipment => ({
  id: 'ship-123',
  tenantId: 'global',
  storeId: 'store-123',
  orderId: 'ord-123',
  fulfillmentId: null,
  carrier: 'mock',
  serviceLevel: 'STANDARD',
  trackingNumber: 'MOCK-TRK-123',
  shippingLabelReference: 'LBL-MOCK-123',
  estimatedDeliveryDate: new Date(),
  shippedAt: null,
  deliveredAt: null,
  status: ShipmentStatus.PREPARED,
  shippingCost: 10,
  history: [{ id: 'th-1', status: 'PREPARED', carrierStatus: 'PREPARED', location: 'Hub' }],
  ...overrides,
});

type TxCallback<T> = (tx: MockPrismaTx) => Promise<T>;

interface MockPrismaTx {
  shipment: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  order: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  shipmentTrackingHistory: {
    create: jest.Mock;
  };
}

describe('ShippingService', () => {
  let service: ShippingService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEventPublisher: jest.Mocked<ShippingEventPublisher>;
  let mockCarrierRegistry: Map<string, CarrierStrategy>;
  let mockTx: MockPrismaTx;
  let mockTenantPrismaService: { exec: jest.Mock };

  beforeEach(async () => {
    mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      invalidatePattern: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CacheService>;

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ShippingEventPublisher>;

    const mockStrategy = new MockCarrierStrategy();
    mockCarrierRegistry = new Map<string, CarrierStrategy>();
    mockCarrierRegistry.set('mock', mockStrategy);

    const defaultShipment = createMockShipment();

    mockTx = {
      shipment: {
        findFirst: jest.fn().mockResolvedValue(defaultShipment),
        findMany: jest.fn().mockResolvedValue([defaultShipment]),
        count: jest.fn().mockResolvedValue(1),
        create: jest.fn().mockResolvedValue(defaultShipment),
        update: jest.fn().mockResolvedValue(defaultShipment),
      },
      order: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ord-123', tenantId: 'global', storeId: 'store-123', subtotal: 100 }),
        update: jest.fn().mockResolvedValue({ id: 'ord-123', status: OrderStatus.SHIPPED }),
      },
      shipmentTrackingHistory: {
        create: jest.fn().mockResolvedValue({ id: 'th-1' }),
      },
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: 'CARRIER_STRATEGY_REGISTRY', useValue: mockCarrierRegistry },
        { provide: 'SHIPPING_COST_CALCULATOR', useClass: DefaultShippingCostCalculator },
        { provide: ShippingEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createShipment', () => {
    it('should create shipment with carrier strategy and publish ShipmentCreated event', async () => {
      const shipment = await service.createShipment({
        orderId: 'ord-123',
        carrier: 'mock',
        serviceLevel: 'EXPRESS',
      });

      expect(shipment.id).toBe('ship-123');
      expect(mockTx.shipment.create).toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ShipmentCreated', orderId: 'ord-123' }),
      );
    });

    it('should throw NotFoundException if order does not exist', async () => {
      mockTx.order.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.createShipment({ orderId: 'invalid-ord', carrier: 'mock' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateShippingLabel', () => {
    it('should generate label via strategy, update status to LABEL_GENERATED, and publish event', async () => {
      const preparedShipment = createMockShipment({ status: ShipmentStatus.PREPARED });
      mockTx.shipment.findFirst.mockResolvedValueOnce(preparedShipment);

      await service.generateShippingLabel('ship-123');

      expect(mockTx.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ShipmentStatus.LABEL_GENERATED }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LabelGenerated' }),
      );
    });
  });

  describe('markShipped & confirmDelivery', () => {
    it('should mark shipment as SHIPPED and synchronize order status', async () => {
      const labelGenShipment = createMockShipment({ status: ShipmentStatus.LABEL_GENERATED });
      mockTx.shipment.findFirst.mockResolvedValueOnce(labelGenShipment);

      await service.markShipped('ship-123');

      expect(mockTx.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ShipmentStatus.SHIPPED }),
        }),
      );
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { status: OrderStatus.SHIPPED, fulfillmentStatus: 'FULFILLED' },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ShipmentDispatched' }),
      );
    });

    it('should confirm delivery and publish ShipmentDelivered event', async () => {
      const shippedShipment = createMockShipment({ status: ShipmentStatus.SHIPPED });
      mockTx.shipment.findFirst.mockResolvedValue(shippedShipment);

      await service.confirmDelivery('ship-123');

      expect(mockTx.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ShipmentStatus.DELIVERED }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ShipmentDelivered' }),
      );
    });
  });

  describe('initiateReturnShipment', () => {
    it('should create return shipment and update order status to RETURNED', async () => {
      await service.initiateReturnShipment({
        orderId: 'ord-123',
        carrier: 'mock',
        reason: 'Item size too small',
      });

      expect(mockTx.shipment.create).toHaveBeenCalled();
      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.RETURNED }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ShipmentReturned' }),
      );
    });
  });

  describe('calculateShippingCost', () => {
    it('should return free shipping cost ($0) when order subtotal is >= 150', () => {
      const cost = service.calculateShippingCost({ orderSubtotal: 200, weightKg: 5 });
      expect(cost).toBe(0);
    });

    it('should calculate weight-based cost for standard order subtotal', () => {
      const cost = service.calculateShippingCost({ orderSubtotal: 50, weightKg: 3 });
      expect(cost).toBe(14); // 10 base + 2 * (3 - 1)
    });
  });
});
