import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { StockQueryDto } from './dto/stock-query.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly db: TenantPrismaService) {}

  async findAllWarehouses(query?: PaginationQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const [items, total] = await Promise.all([
        tx.warehouse.findMany({
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        tx.warehouse.count(),
      ]);
      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async findWarehouseById(id: string) {
    const warehouse = await this.db.exec(async (tx) => {
      return tx.warehouse.findUnique({
        where: { id },
      });
    });
    if (!warehouse) {
      throw new BadRequestException(`Warehouse with ID ${id} not found`);
    }
    return warehouse;
  }

  async createWarehouse(data: { name: string; isActive?: boolean }) {
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId || '';

    return this.db.exec(async (tx) => {
      return tx.warehouse.create({
        data: {
          name: data.name,
          isActive: data.isActive ?? true,
          tenantId,
        },
      });
    });
  }

  async updateWarehouse(id: string, data: { name?: string; isActive?: boolean }) {
    await this.findWarehouseById(id);
    return this.db.exec(async (tx) => {
      return tx.warehouse.update({
        where: { id },
        data,
      });
    });
  }

  async removeWarehouse(id: string) {
    await this.findWarehouseById(id);
    return this.db.exec(async (tx) => {
      return tx.warehouse.delete({
        where: { id },
      });
    });
  }

  async getAllStockLevels(query?: StockQueryDto) {
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const where: Prisma.StockLevelWhereInput = {};
      if (query?.variantId) where.variantId = query.variantId;
      if (query?.warehouseId) where.warehouseId = query.warehouseId;

      const [items, total] = await Promise.all([
        tx.stockLevel.findMany({
          where,
          include: {
            warehouse: true,
            variant: true,
          },
          take,
          skip,
        }),
        tx.stockLevel.count({ where }),
      ]);
      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async getStock(variantId: string) {
    return this.db.exec(async (tx) => {
      return tx.stockLevel.findMany({
        where: { variantId },
        include: { warehouse: true },
      });
    });
  }

  async adjustStock(data: {
    warehouseId: string;
    variantId: string;
    quantityChange: number;
    reason: string;
    referenceId?: string;
  }) {
    return this.db.exec(async (tx) => {
      const ctx = requestContextStorage.getStore();
      const tenantId = ctx?.tenantId || '';
      const userId = ctx?.userId || null;

      // Execute pessimistic row locking FOR UPDATE
      const stock: Array<{ quantity_physical: number; quantity_reserved: number }> = await tx.$queryRaw`
        SELECT "quantity_physical", "quantity_reserved"
        FROM stock_levels
        WHERE tenant_id = ${tenantId}::uuid AND variant_id = ${data.variantId}::uuid AND warehouse_id = ${data.warehouseId}::uuid
        FOR UPDATE
      `;

      let currentPhysical = 0;
      let currentReserved = 0;

      if (stock && stock.length > 0) {
        currentPhysical = stock[0].quantity_physical || 0;
        currentReserved = stock[0].quantity_reserved || 0;
      }

      // Prevent negative inventory when decreasing stock
      const available = currentPhysical - currentReserved;
      if (data.quantityChange < 0 && Math.abs(data.quantityChange) > available) {
        throw new BadRequestException(
          `Cannot reduce stock by ${Math.abs(data.quantityChange)}. Only ${available} available items in stock.`
        );
      }

      const newPhysical = Math.max(0, currentPhysical + data.quantityChange);

      const updatedStock = await tx.stockLevel.upsert({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId: data.warehouseId,
            variantId: data.variantId,
          },
        },
        create: {
          tenantId,
          warehouseId: data.warehouseId,
          variantId: data.variantId,
          quantityPhysical: Math.max(0, data.quantityChange),
          quantityReserved: 0,
        },
        update: {
          quantityPhysical: newPhysical,
        },
      });

      // Record StockMovement audit entry
      await tx.stockMovement.create({
        data: {
          tenantId,
          warehouseId: data.warehouseId,
          variantId: data.variantId,
          quantityChange: data.quantityChange,
          type: data.quantityChange >= 0 ? 'RESTOCK' : 'ADJUSTMENT',
          reason: data.reason,
          referenceId: data.referenceId,
          createdBy: userId,
        },
      });

      return updatedStock;
    });
  }

  async reserveStock(variantId: string, warehouseId: string, qty: number) {
    return this.db.exec(async (tx) => {
      const ctx = requestContextStorage.getStore();
      const tenantId = ctx?.tenantId || '';

      const stock: Array<{ quantity_physical: number; quantity_reserved: number }> = await tx.$queryRaw`
        SELECT "quantity_physical", "quantity_reserved"
        FROM stock_levels
        WHERE tenant_id = ${tenantId}::uuid AND variant_id = ${variantId}::uuid AND warehouse_id = ${warehouseId}::uuid
        FOR UPDATE
      `;

      if (!stock || stock.length === 0) {
        throw new BadRequestException('Inventory record not found for variant at selected warehouse');
      }

      const quantityPhysical = stock[0].quantity_physical || 0;
      const quantityReserved = stock[0].quantity_reserved || 0;
      const available = quantityPhysical - quantityReserved;

      if (available < qty) {
        throw new BadRequestException(`Insufficient stock available (Requested: ${qty}, Available: ${available})`);
      }

      return tx.stockLevel.update({
        where: {
          tenantId_warehouseId_variantId: {
            tenantId,
            warehouseId,
            variantId,
          },
        },
        data: {
          quantityReserved: quantityReserved + qty,
        },
      });
    });
  }
}
