import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { OrderStatus, ShipmentStatus, FulfillmentStatus, Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { FulfillmentEventPublisher } from './events/fulfillment-event-publisher.service.js';

@Injectable()
export class FulfillmentService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    private readonly eventPublisher: FulfillmentEventPublisher,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  private readonly validTransitions: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.DRAFT]: [OrderStatus.PENDING, OrderStatus.CONFIRMED],
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
    [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.PACKED, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.PACKED, OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.PACKED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.AUTHORIZED]: [OrderStatus.PAID, OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PARTIALLY_FULFILLED]: [OrderStatus.FULFILLED, OrderStatus.CANCELLED],
    [OrderStatus.FULFILLED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
    [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED, OrderStatus.RETURNED],
    [OrderStatus.COMPLETED]: [OrderStatus.RETURNED],
    [OrderStatus.RETURNED]: [OrderStatus.REFUNDED],
    [OrderStatus.REFUNDED]: [],
    [OrderStatus.CANCELLED]: [],
  };

  private validateStateTransition(current: OrderStatus, target: OrderStatus) {
    const allowed = this.validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid Order status transition from '${current}' to '${target}'. Allowed transitions: [${allowed.join(', ')}]`,
      );
    }
  }

  async findAll(query?: PaginationQueryDto) {
    const tenantId = this.getTenantId();
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const [items, total] = await Promise.all([
        tx.shipment.findMany({
          where: { tenantId },
          include: {
            order: true,
          },
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        tx.shipment.count({ where: { tenantId } }),
      ]);
      return new PaginatedResponseDto(items, total, query?.page || 1, query?.limit || 20);
    });
  }

  async createShipment(orderId: string, carrier: string, trackingNumber: string) {
    return this.prepareShipment(orderId, carrier, trackingNumber);
  }

  async prepareShipment(orderId: string, carrier: string, trackingNumber: string, warehouseId?: string) {
    const tenantId = this.getTenantId();

    const shipment = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      this.validateStateTransition(order.status, OrderStatus.PACKED);

      const createdShipment = await tx.shipment.create({
        data: {
          tenantId,
          orderId,
          carrier,
          trackingNumber,
          status: ShipmentStatus.PACKED,
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PACKED,
          fulfillmentStatus: FulfillmentStatus.PACKED,
        },
      });

      return createdShipment;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${orderId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentPrepared',
      tenantId,
      orderId,
      shipmentId: shipment.id,
      warehouseId,
      occurredAt: new Date(),
    });

    return shipment;
  }

  async markPacked(shipmentId: string) {
    const tenantId = this.getTenantId();
    const shipment = await this.db.exec(async (tx) => {
      const s = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
        include: { order: true },
      });
      if (!s) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.PACKED },
      });

      await tx.order.update({
        where: { id: s.orderId },
        data: {
          status: OrderStatus.PACKED,
          fulfillmentStatus: FulfillmentStatus.PACKED,
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${shipment.orderId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentPrepared',
      tenantId,
      orderId: shipment.orderId,
      shipmentId,
      occurredAt: new Date(),
    });

    return shipment;
  }

  async markShipped(shipmentId: string) {
    const tenantId = this.getTenantId();
    const shipment = await this.db.exec(async (tx) => {
      const s = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!s) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.DISPATCHED,
          shippedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: s.orderId },
        data: {
          status: OrderStatus.SHIPPED,
          fulfillmentStatus: FulfillmentStatus.FULFILLED,
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${shipment.orderId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentShipped',
      tenantId,
      orderId: shipment.orderId,
      shipmentId,
      occurredAt: new Date(),
    });

    return shipment;
  }

  async updateStatus(id: string, status: ShipmentStatus) {
    if (status === ShipmentStatus.DISPATCHED || status === ShipmentStatus.IN_TRANSIT || status === ShipmentStatus.OUT_FOR_DELIVERY) {
      return this.markShipped(id);
    }
    if (status === ShipmentStatus.DELIVERED) {
      return this.markDelivered(id);
    }
    if (status === ShipmentStatus.PACKED) {
      return this.markPacked(id);
    }

    const tenantId = this.getTenantId();
    return this.db.exec(async (tx) => {
      const shipment = await tx.shipment.findFirst({ where: { id, tenantId } });
      if (!shipment) {
        throw new NotFoundException(`Shipment with ID ${id} not found`);
      }

      const data: Prisma.ShipmentUpdateInput = { status };
      return tx.shipment.update({ where: { id }, data });
    });
  }

  async markDelivered(shipmentId: string) {
    const tenantId = this.getTenantId();
    const shipment = await this.db.exec(async (tx) => {
      const s = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!s) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.DELIVERED,
          deliveredAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: s.orderId },
        data: {
          status: OrderStatus.DELIVERED,
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${shipment.orderId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentDelivered',
      tenantId,
      orderId: shipment.orderId,
      shipmentId,
      occurredAt: new Date(),
    });

    return shipment;
  }

  async completeOrder(orderId: string) {
    const tenantId = this.getTenantId();
    const order = await this.db.exec(async (tx) => {
      const o = await tx.order.findFirst({
        where: { id: orderId, tenantId },
      });
      if (!o) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      this.validateStateTransition(o.status, OrderStatus.COMPLETED);

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          fulfillmentStatus: FulfillmentStatus.COMPLETED,
        },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${orderId}`);

    await this.eventPublisher.publish({
      eventType: 'OrderCompleted',
      tenantId,
      orderId,
      occurredAt: new Date(),
    });

    return order;
  }

  async cancelFulfillment(shipmentId: string) {
    const tenantId = this.getTenantId();
    const shipment = await this.db.exec(async (tx) => {
      const s = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!s) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.FAILED },
      });

      await tx.order.update({
        where: { id: s.orderId },
        data: { fulfillmentStatus: FulfillmentStatus.UNFULFILLED },
      });

      return updated;
    });

    await this.releaseInventory(shipment.orderId);

    await this.eventPublisher.publish({
      eventType: 'InventoryReleased',
      tenantId,
      orderId: shipment.orderId,
      shipmentId,
      occurredAt: new Date(),
    });

    return shipment;
  }

  async processReturn(orderId: string, reason?: string, restock: boolean = true, warehouseId?: string) {
    const tenantId = this.getTenantId();

    const order = await this.db.exec(async (tx) => {
      const o = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
      if (!o) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      this.validateStateTransition(o.status, OrderStatus.RETURNED);

      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.RETURNED,
          fulfillmentStatus: FulfillmentStatus.RETURNED,
          notes: reason ? `${o.notes || ''}\nReturn reason: ${reason}`.trim() : o.notes,
        },
      });

      return updated;
    });

    if (restock) {
      await this.restockInventory(orderId, warehouseId);
    }

    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${orderId}`);
    return order;
  }

  async reserveInventory(orderId: string, warehouseId?: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (!warehouseId) {
        const wh = await tx.warehouse.findFirst({ where: { tenantId, isActive: true } });
        if (wh) warehouseId = wh.id;
      }

      if (warehouseId) {
        for (const item of order.items) {
          const stock = await (tx as any).stockLevel.findFirst({
            where: { tenantId, variantId: item.variantId, warehouseId },
          });
          if (stock) {
            const available = stock.quantityPhysical - stock.quantityReserved;
            if (available < item.quantity) {
              throw new BadRequestException(`Insufficient physical inventory to reserve for variant ${item.variantId}`);
            }
            await (tx as any).stockLevel.update({
              where: {
                tenantId_warehouseId_variantId: { tenantId, warehouseId, variantId: item.variantId },
              },
              data: {
                quantityReserved: stock.quantityReserved + item.quantity,
              },
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                warehouseId,
                variantId: item.variantId,
                quantityChange: item.quantity,
                type: 'RESERVATION',
                reason: 'ORDER_RESERVATION',
                referenceId: order.id,
                createdBy: userId,
              },
            });
          }
        }
      }
    });

    await this.eventPublisher.publish({
      eventType: 'InventoryReserved',
      tenantId,
      orderId,
      warehouseId,
      occurredAt: new Date(),
    });
  }

  async commitInventory(orderId: string, warehouseId?: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (!warehouseId) {
        const wh = await tx.warehouse.findFirst({ where: { tenantId, isActive: true } });
        if (wh) warehouseId = wh.id;
      }

      if (warehouseId) {
        for (const item of order.items) {
          const stock = await (tx as any).stockLevel.findFirst({
            where: { tenantId, variantId: item.variantId, warehouseId },
          });
          if (stock) {
            const newPhysical = Math.max(0, stock.quantityPhysical - item.quantity);
            const newReserved = Math.max(0, stock.quantityReserved - item.quantity);

            await (tx as any).stockLevel.update({
              where: {
                tenantId_warehouseId_variantId: { tenantId, warehouseId, variantId: item.variantId },
              },
              data: {
                quantityPhysical: newPhysical,
                quantityReserved: newReserved,
              },
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                warehouseId,
                variantId: item.variantId,
                quantityChange: -item.quantity,
                type: 'SALE',
                reason: 'FULFILLMENT_COMMIT',
                referenceId: order.id,
                createdBy: userId,
              },
            });
          }
        }
      }
    });

    await this.eventPublisher.publish({
      eventType: 'InventoryCommitted',
      tenantId,
      orderId,
      warehouseId,
      occurredAt: new Date(),
    });
  }

  async releaseInventory(orderId: string, warehouseId?: string) {
    const tenantId = this.getTenantId();

    await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
      if (!order) return;

      if (!warehouseId) {
        const wh = await tx.warehouse.findFirst({ where: { tenantId, isActive: true } });
        if (wh) warehouseId = wh.id;
      }

      if (warehouseId) {
        for (const item of order.items) {
          const stock = await (tx as any).stockLevel.findFirst({
            where: { tenantId, variantId: item.variantId, warehouseId },
          });
          if (stock) {
            const newReserved = Math.max(0, stock.quantityReserved - item.quantity);
            await (tx as any).stockLevel.update({
              where: {
                tenantId_warehouseId_variantId: { tenantId, warehouseId, variantId: item.variantId },
              },
              data: {
                quantityReserved: newReserved,
              },
            });
          }
        }
      }
    });

    await this.eventPublisher.publish({
      eventType: 'InventoryReleased',
      tenantId,
      orderId,
      warehouseId,
      occurredAt: new Date(),
    });
  }

  async restockInventory(orderId: string, warehouseId?: string) {
    const tenantId = this.getTenantId();
    const ctx = requestContextStorage.getStore();
    const userId = ctx?.userId || null;

    await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, tenantId },
        include: { items: true },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      if (!warehouseId) {
        const wh = await tx.warehouse.findFirst({ where: { tenantId, isActive: true } });
        if (wh) warehouseId = wh.id;
      }

      if (warehouseId) {
        for (const item of order.items) {
          const stock = await (tx as any).stockLevel.findFirst({
            where: { tenantId, variantId: item.variantId, warehouseId },
          });
          if (stock) {
            await (tx as any).stockLevel.update({
              where: {
                tenantId_warehouseId_variantId: { tenantId, warehouseId, variantId: item.variantId },
              },
              data: {
                quantityPhysical: stock.quantityPhysical + item.quantity,
              },
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                warehouseId,
                variantId: item.variantId,
                quantityChange: item.quantity,
                type: 'RESTOCK',
                reason: 'ORDER_RETURN_RESTOCK',
                referenceId: order.id,
                createdBy: userId,
              },
            });
          }
        }
      }
    });

    await this.eventPublisher.publish({
      eventType: 'InventoryRestocked',
      tenantId,
      orderId,
      warehouseId,
      occurredAt: new Date(),
    });
  }
}
