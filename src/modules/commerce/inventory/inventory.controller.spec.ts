import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from './inventory.service.js';
import { AuthGuard } from '../../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../../security/guards/permissions.guard.js';

describe('InventoryController', () => {
  let controller: InventoryController;
  let mockInventoryService: any;

  const mockStockLevel = {
    id: 'stock-123',
    variantId: 'var-123',
    warehouseId: 'wh-123',
    quantityPhysical: 100,
  };

  const mockPaginated = {
    data: [mockStockLevel],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  beforeEach(async () => {
    mockInventoryService = {
      getAllStockLevels: jest.fn().mockResolvedValue(mockPaginated),
      getStock: jest.fn().mockResolvedValue([mockStockLevel]),
      adjustStock: jest.fn().mockResolvedValue({ ...mockStockLevel, quantityPhysical: 120 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InventoryController>(InventoryController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStockLevels', () => {
    it('should return variant stock array directly if variantId passed without pagination flags', async () => {
      const query = { variantId: 'var-123' } as any;
      const result = await controller.getStockLevels(query);
      expect(result).toEqual([mockStockLevel]);
      expect(mockInventoryService.getStock).toHaveBeenCalledWith('var-123');
    });

    it('should return paginated stock levels when warehouseId or pagination is specified', async () => {
      const query = { variantId: 'var-123', warehouseId: 'wh-123', page: 1, limit: 20 } as any;
      const result = await controller.getStockLevels(query);
      expect(result).toEqual(mockPaginated);
      expect(mockInventoryService.getAllStockLevels).toHaveBeenCalledWith(query);
    });
  });

  describe('adjustStock', () => {
    it('should adjust physical stock balance and record movement', async () => {
      const dto = { warehouseId: 'wh-123', variantId: 'var-123', quantityChange: 20, reason: 'Restock' } as any;
      const result = await controller.adjustStock(dto);
      expect(result.quantityPhysical).toBe(120);
      expect(mockInventoryService.adjustStock).toHaveBeenCalledWith(dto);
    });
  });
});
