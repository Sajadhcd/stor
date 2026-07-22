import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service.js';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { BadRequestException } from '@nestjs/common';
import { requestContextStorage } from '../../../common/context/request-context.js';

describe('InventoryService', () => {
  let service: InventoryService;
  let mockTenantPrismaService: any;

  const mockWarehouse = {
    id: 'wh-123',
    tenantId: 'tenant-123',
    name: 'Main Riyadh Warehouse',
    isActive: true,
  };

  const mockStockLevel = {
    id: 'stock-123',
    tenantId: 'tenant-123',
    warehouseId: 'wh-123',
    variantId: 'var-123',
    quantityPhysical: 100,
    quantityReserved: 10,
  };

  beforeEach(async () => {
    mockTenantPrismaService = {
      exec: jest.fn().mockImplementation((callback) => {
        const mockTx = {
          warehouse: {
            findMany: jest.fn().mockResolvedValue([mockWarehouse]),
            count: jest.fn().mockResolvedValue(1),
            findUnique: jest.fn().mockResolvedValue(mockWarehouse),
            create: jest.fn().mockResolvedValue(mockWarehouse),
            update: jest.fn().mockResolvedValue(mockWarehouse),
            delete: jest.fn().mockResolvedValue(mockWarehouse),
          },
          stockLevel: {
            findMany: jest.fn().mockResolvedValue([mockStockLevel]),
            count: jest.fn().mockResolvedValue(1),
            upsert: jest.fn().mockResolvedValue({ ...mockStockLevel, quantityPhysical: 120 }),
            update: jest.fn().mockResolvedValue({ ...mockStockLevel, quantityReserved: 15 }),
          },
          stockMovement: {
            create: jest.fn().mockResolvedValue({ id: 'move-123' }),
          },
          $queryRaw: jest.fn().mockResolvedValue([
            { quantity_physical: 100, quantity_reserved: 10 },
          ]),
        };
        return callback(mockTx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: TenantPrismaService, useValue: mockTenantPrismaService },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllWarehouses', () => {
    it('should return paginated warehouses', async () => {
      const result = await service.findAllWarehouses({ page: 1, limit: 10 } as any);
      expect(result.data).toEqual([mockWarehouse]);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    });
  });

  describe('findWarehouseById', () => {
    it('should return warehouse details', async () => {
      const result = await service.findWarehouseById('wh-123');
      expect(result).toEqual(mockWarehouse);
    });

    it('should throw BadRequestException if warehouse not found', async () => {
      mockTenantPrismaService.exec.mockImplementationOnce((callback: any) => {
        const mockTx = { warehouse: { findUnique: jest.fn().mockResolvedValue(null) } };
        return callback(mockTx);
      });

      await expect(service.findWarehouseById('invalid-wh')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAllStockLevels', () => {
    it('should return paginated stock levels', async () => {
      const result = await service.getAllStockLevels({ variantId: 'var-123', page: 1, limit: 20 } as any);
      expect(result.data).toEqual([mockStockLevel]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  describe('adjustStock', () => {
    it('should adjust stock level with pessimistic lock and record stock movement', async () => {
      requestContextStorage.run({ tenantId: 'tenant-123', userId: 'user-1', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        const result = await service.adjustStock({
          warehouseId: 'wh-123',
          variantId: 'var-123',
          quantityChange: 20,
          reason: 'Restocking shipment #123',
        });
        expect(result.quantityPhysical).toBe(120);
      });
    });

    it('should throw BadRequestException if negative change exceeds available stock', async () => {
      requestContextStorage.run({ tenantId: 'tenant-123', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        await expect(
          service.adjustStock({
            warehouseId: 'wh-123',
            variantId: 'var-123',
            quantityChange: -200, // Available is 100 - 10 = 90
            reason: 'Damaged goods check',
          }),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('reserveStock', () => {
    it('should increment reserved stock if available', async () => {
      requestContextStorage.run({ tenantId: 'tenant-123', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        const result = await service.reserveStock('var-123', 'wh-123', 5);
        expect(result.quantityReserved).toBe(15);
      });
    });

    it('should throw BadRequestException if requested reservation exceeds available stock', async () => {
      requestContextStorage.run({ tenantId: 'tenant-123', requestId: 'req-1', correlationId: 'corr-1' }, async () => {
        await expect(service.reserveStock('var-123', 'wh-123', 95)).rejects.toThrow(
          BadRequestException,
        );
      });
    });
  });
});
