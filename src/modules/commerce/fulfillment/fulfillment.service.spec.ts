import { Test, TestingModule } from '@nestjs/testing';
import { FulfillmentService } from './fulfillment.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { FulfillmentEventPublisher } from './events/fulfillment-event-publisher.service.js';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { OrderStatus, ShipmentStatus, FulfillmentStatus } from '@prisma/client';

interface MockOrder {
  id: string;
  tenantId: string;
  storeId: string;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus;
  notes?: string | null;
  items: Array<{ variantId: string; quantity: number }>;
}

interface MockShipment {
  id: string;
  tenantId: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  status: ShipmentStatus;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
}

const createMockOrder = (overrides?: Partial<MockOrder>): MockOrder => ({
  id: 'ord-123',
  tenantId: 'global',
  storeId: 'store-123',
  status: OrderStatus.PAID,
  fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
  items: [{ variantId: 'var-1', quantity: 2 }],
  ...overrides,
});

const createMockShipment = (overrides?: Partial<MockShipment>): MockShipment => ({
  id: 'ship-123',
  tenantId: 'global',
  orderId: 'ord-123',
  carrier: 'DHL',
  trackingNumber: 'TRK123456',
  status: ShipmentStatus.PACKED,
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
  warehouse: {
    findFirst: jest.Mock;
  };
  stockLevel: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  stockMovement: {
    create: jest.Mock;
  };
}

describe('FulfillmentService', () => {
  let service: FulfillmentService;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockEventPublisher: jest.Mocked<FulfillmentEventPublisher>;
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
    } as unknown as jest.Mocked<FulfillmentEventPublisher>;

    const defaultOrder = createMockOrder();
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
        findFirst: jest.fn().mockResolvedValue(defaultOrder),
        update: jest.fn().mockResolvedValue(defaultOrder),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true }),
      },
      stockLevel: {
        findFirst: jest.fn().mockResolvedValue({ quantityPhysical: 100, quantityReserved: 10 }),
        update: jest.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-1' }),
      },
    };

    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation(<T>(cb: TxCallback<T>) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FulfillmentService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: FulfillmentEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<FulfillmentService>(FulfillmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('prepareShipment', () => {
    it('should prepare shipment, transition order status to PACKED, and publish ShipmentPrepared event', async () => {
      const result = await service.prepareShipment('ord-123', 'DHL', 'TRK123456');

      expect(result.id).toBe('ship-123');
      expect(mockTx.shipment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'ord-123',
            carrier: 'DHL',
            trackingNumber: 'TRK123456',
            status: ShipmentStatus.PACKED,
          }),
        }),
      );
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { status: OrderStatus.PACKED, fulfillmentStatus: FulfillmentStatus.PACKED },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ShipmentPrepared', orderId: 'ord-123' }),
      );
    });

    it('should throw BadRequestException on invalid state transition', async () => {
      const cancelledOrder = createMockOrder({ status: OrderStatus.CANCELLED });
      mockTx.order.findFirst.mockResolvedValueOnce(cancelledOrder);

      await expect(service.prepareShipment('ord-123', 'DHL', 'TRK123456')).rejects.toThrow(BadRequestException);
    });
  });

  describe('markShipped & markDelivered & completeOrder', () => {
    it('should mark shipment as shipped and publish ShipmentShipped event', async () => {
      await service.markShipped('ship-123');

      expect(mockTx.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ShipmentStatus.DISPATCHED }),
        }),
      );
      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { status: OrderStatus.SHIPPED, fulfillmentStatus: FulfillmentStatus.FULFILLED },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ShipmentShipped' }),
      );
    });

    it('should complete delivered order and publish OrderCompleted event', async () => {
      const deliveredOrder = createMockOrder({ status: OrderStatus.DELIVERED });
      mockTx.order.findFirst.mockResolvedValueOnce(deliveredOrder);

      await service.completeOrder('ord-123');

      expect(mockTx.order.update).toHaveBeenCalledWith({
        where: { id: 'ord-123' },
        data: { status: OrderStatus.COMPLETED, fulfillmentStatus: FulfillmentStatus.COMPLETED },
      });
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'OrderCompleted' }),
      );
    });
  });

  describe('processReturn & restockInventory', () => {
    it('should process return, restock inventory, and publish InventoryRestocked event', async () => {
      const deliveredOrder = createMockOrder({ status: OrderStatus.DELIVERED });
      mockTx.order.findFirst.mockResolvedValue(deliveredOrder);

      await service.processReturn('ord-123', 'Defective item', true, 'wh-1');

      expect(mockTx.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: OrderStatus.RETURNED, fulfillmentStatus: FulfillmentStatus.RETURNED }),
        }),
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'InventoryRestocked' }),
      );
    });
  });
});
