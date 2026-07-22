import { Test, TestingModule } from '@nestjs/testing';
import { FulfillmentController } from './fulfillment.controller.js';
import { FulfillmentService } from './fulfillment.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';

describe('FulfillmentController', () => {
  let controller: FulfillmentController;
  let mockFulfillmentService: jest.Mocked<Partial<FulfillmentService>>;

  const mockShipment = {
    id: 'ship-123',
    orderId: 'ord-123',
    carrier: 'DHL',
    trackingNumber: 'TRK123456',
    status: 'PACKED',
  };

  const mockPaginated = {
    data: [mockShipment],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  beforeEach(async () => {
    mockFulfillmentService = {
      findAll: jest.fn().mockResolvedValue(mockPaginated),
      prepareShipment: jest.fn().mockResolvedValue(mockShipment),
      markPacked: jest.fn().mockResolvedValue(mockShipment),
      markShipped: jest.fn().mockResolvedValue({ ...mockShipment, status: 'DISPATCHED' }),
      markDelivered: jest.fn().mockResolvedValue({ ...mockShipment, status: 'DELIVERED' }),
      cancelFulfillment: jest.fn().mockResolvedValue({ ...mockShipment, status: 'FAILED' }),
      completeOrder: jest.fn().mockResolvedValue({ id: 'ord-123', status: 'COMPLETED' }),
      processReturn: jest.fn().mockResolvedValue({ id: 'ord-123', status: 'RETURNED' }),
      reserveInventory: jest.fn().mockResolvedValue(undefined),
      commitInventory: jest.fn().mockResolvedValue(undefined),
      releaseInventory: jest.fn().mockResolvedValue(undefined),
      restockInventory: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FulfillmentController],
      providers: [
        { provide: FulfillmentService, useValue: mockFulfillmentService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FulfillmentController>(FulfillmentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listShipments', () => {
    it('should return paginated shipments list', async () => {
      const query = { page: 1, limit: 20, skip: 0, take: 20 };
      const result = await controller.listShipments(query);
      expect(result).toEqual(mockPaginated);
      expect(mockFulfillmentService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('prepareShipment', () => {
    it('should prepare shipment', async () => {
      const dto = { orderId: 'ord-123', carrier: 'DHL', trackingNumber: 'TRK123456' };
      const result = await controller.prepareShipment(dto);
      expect(result).toEqual(mockShipment);
      expect(mockFulfillmentService.prepareShipment).toHaveBeenCalledWith('ord-123', 'DHL', 'TRK123456', undefined);
    });
  });

  describe('markShipped & markDelivered', () => {
    it('should mark shipment as shipped', async () => {
      const result = await controller.markShipped('ship-123');
      expect(result.status).toBe('DISPATCHED');
      expect(mockFulfillmentService.markShipped).toHaveBeenCalledWith('ship-123');
    });

    it('should mark shipment as delivered', async () => {
      const result = await controller.markDelivered('ship-123');
      expect(result.status).toBe('DELIVERED');
      expect(mockFulfillmentService.markDelivered).toHaveBeenCalledWith('ship-123');
    });
  });
});
