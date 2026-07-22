import { Test, TestingModule } from '@nestjs/testing';
import { ShippingController } from './shipping.controller.js';
import { ShippingService } from './shipping.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';

describe('ShippingController', () => {
  let controller: ShippingController;
  let mockShippingService: jest.Mocked<Partial<ShippingService>>;

  const mockShipment = {
    id: 'ship-123',
    orderId: 'ord-123',
    carrier: 'dhl',
    trackingNumber: 'DHL-TRK-123',
    shippingCost: 15,
    status: 'PREPARED',
  };

  const mockPaginated = {
    data: [mockShipment],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  beforeEach(async () => {
    mockShippingService = {
      listShipments: jest.fn().mockResolvedValue(mockPaginated),
      getShipment: jest.fn().mockResolvedValue(mockShipment),
      createShipment: jest.fn().mockResolvedValue(mockShipment),
      calculateShippingCost: jest.fn().mockReturnValue(15),
      generateShippingLabel: jest.fn().mockResolvedValue({ ...mockShipment, status: 'LABEL_GENERATED' }),
      markShipped: jest.fn().mockResolvedValue({ ...mockShipment, status: 'SHIPPED' }),
      updateTrackingStatus: jest.fn().mockResolvedValue({ ...mockShipment, status: 'IN_TRANSIT' }),
      confirmDelivery: jest.fn().mockResolvedValue({ ...mockShipment, status: 'DELIVERED' }),
      initiateReturnShipment: jest.fn().mockResolvedValue({ ...mockShipment, status: 'PREPARED' }),
      cancelShipment: jest.fn().mockResolvedValue({ ...mockShipment, status: 'CANCELLED' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShippingController],
      providers: [
        { provide: ShippingService, useValue: mockShippingService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ShippingController>(ShippingController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listShipments', () => {
    it('should return paginated shipments list', async () => {
      const query = { page: 1, limit: 20, skip: 0, take: 20 };
      const result = await controller.listShipments(query);
      expect(result).toEqual(mockPaginated);
      expect(mockShippingService.listShipments).toHaveBeenCalledWith(query);
    });
  });

  describe('calculateCost', () => {
    it('should calculate estimated shipping cost', async () => {
      const result = await controller.calculateCost({ weightKg: 2, carrier: 'dhl' });
      expect(result).toEqual({ shippingCost: 15 });
      expect(mockShippingService.calculateShippingCost).toHaveBeenCalledWith({ weightKg: 2, carrier: 'dhl' });
    });
  });

  describe('createShipment', () => {
    it('should create shipment', async () => {
      const dto = { orderId: 'ord-123', carrier: 'dhl' };
      const result = await controller.createShipment(dto);
      expect(result).toEqual(mockShipment);
      expect(mockShippingService.createShipment).toHaveBeenCalledWith(dto);
    });
  });
});
