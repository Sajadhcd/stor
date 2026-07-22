import { Test, TestingModule } from '@nestjs/testing';
import { WarehousesController } from './warehouses.controller.js';
import { InventoryService } from './inventory.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';

describe('WarehousesController', () => {
  let controller: WarehousesController;
  let mockInventoryService: any;

  const mockWarehouse = {
    id: 'wh-123',
    name: 'Main Riyadh Warehouse',
    isActive: true,
  };

  const mockPaginated = {
    data: [mockWarehouse],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  beforeEach(async () => {
    mockInventoryService = {
      findAllWarehouses: jest.fn().mockResolvedValue(mockPaginated),
      findWarehouseById: jest.fn().mockResolvedValue(mockWarehouse),
      createWarehouse: jest.fn().mockResolvedValue(mockWarehouse),
      updateWarehouse: jest.fn().mockResolvedValue({ ...mockWarehouse, name: 'Updated Name' }),
      removeWarehouse: jest.fn().mockResolvedValue(mockWarehouse),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WarehousesController],
      providers: [
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<WarehousesController>(WarehousesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated warehouses list', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockPaginated);
      expect(mockInventoryService.findAllWarehouses).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should return warehouse details by ID', async () => {
      const result = await controller.findOne('wh-123');
      expect(result).toEqual(mockWarehouse);
      expect(mockInventoryService.findWarehouseById).toHaveBeenCalledWith('wh-123');
    });
  });

  describe('create', () => {
    it('should create a new warehouse', async () => {
      const dto = { name: 'Main Riyadh Warehouse', isActive: true };
      const result = await controller.create(dto);
      expect(result).toEqual(mockWarehouse);
      expect(mockInventoryService.createWarehouse).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update warehouse details', async () => {
      const dto = { name: 'Updated Name' };
      const result = await controller.update('wh-123', dto);
      expect(result.name).toBe('Updated Name');
      expect(mockInventoryService.updateWarehouse).toHaveBeenCalledWith('wh-123', dto);
    });
  });

  describe('remove', () => {
    it('should remove warehouse by ID', async () => {
      const result = await controller.remove('wh-123');
      expect(result).toEqual(mockWarehouse);
      expect(mockInventoryService.removeWarehouse).toHaveBeenCalledWith('wh-123');
    });
  });
});
