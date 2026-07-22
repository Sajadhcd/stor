import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { TenantPrismaService } from '../../../infrastructure/database/tenant-prisma.service.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { requestContextStorage } from '../../../common/context/request-context.js';
import { ShipmentStatus, OrderStatus, FulfillmentStatus, Prisma } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto/paginated-response.dto.js';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { CreateShipmentDto } from './dto/create-shipment.dto.js';
import { CalculateShippingCostDto } from './dto/calculate-shipping-cost.dto.js';
import { UpdateTrackingDto } from './dto/update-tracking.dto.js';
import { InitiateReturnShipmentDto } from './dto/initiate-return-shipment.dto.js';
import { CarrierStrategy } from './strategies/carrier-strategy.interface.js';
import type { ShippingCostCalculator } from './calculators/shipping-cost-calculator.interface.js';
import { ShippingEventPublisher } from './events/shipping-event-publisher.service.js';

@Injectable()
export class ShippingService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly cache: CacheService,
    @Inject('CARRIER_STRATEGY_REGISTRY') private readonly carrierRegistry: Map<string, CarrierStrategy>,
    @Inject('SHIPPING_COST_CALCULATOR') private readonly costCalculator: ShippingCostCalculator,
    private readonly eventPublisher: ShippingEventPublisher,
  ) {}

  private getTenantId(): string {
    const ctx = requestContextStorage.getStore();
    return ctx?.tenantId || 'global';
  }

  private resolveCarrierStrategy(carrier: string): CarrierStrategy {
    const key = carrier.toLowerCase();
    const strategy = this.carrierRegistry.get(key);
    if (!strategy) {
      const fallback = this.carrierRegistry.get('mock');
      if (fallback) return fallback;
      throw new BadRequestException(`Carrier strategy '${carrier}' not supported`);
    }
    return strategy;
  }

  private readonly validTransitions: Record<ShipmentStatus, ShipmentStatus[]> = {
    [ShipmentStatus.DRAFT]: [ShipmentStatus.PENDING, ShipmentStatus.PREPARED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.PENDING]: [ShipmentStatus.PREPARED, ShipmentStatus.LABEL_GENERATED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.PREPARED]: [ShipmentStatus.LABEL_GENERATED, ShipmentStatus.PACKED, ShipmentStatus.DISPATCHED, ShipmentStatus.SHIPPED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.LABEL_GENERATED]: [ShipmentStatus.PACKED, ShipmentStatus.DISPATCHED, ShipmentStatus.SHIPPED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.PACKED]: [ShipmentStatus.DISPATCHED, ShipmentStatus.SHIPPED, ShipmentStatus.CANCELLED],
    [ShipmentStatus.DISPATCHED]: [ShipmentStatus.SHIPPED, ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.FAILED],
    [ShipmentStatus.SHIPPED]: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED, ShipmentStatus.FAILED],
    [ShipmentStatus.IN_TRANSIT]: [ShipmentStatus.OUT_FOR_DELIVERY, ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED, ShipmentStatus.FAILED],
    [ShipmentStatus.OUT_FOR_DELIVERY]: [ShipmentStatus.DELIVERED, ShipmentStatus.RETURNED, ShipmentStatus.FAILED],
    [ShipmentStatus.DELIVERED]: [ShipmentStatus.RETURNED],
    [ShipmentStatus.RETURNED]: [],
    [ShipmentStatus.FAILED]: [],
    [ShipmentStatus.CANCELLED]: [],
  };

  private validateStatusTransition(current: ShipmentStatus, target: ShipmentStatus) {
    const allowed = this.validTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid Shipment status transition from '${current}' to '${target}'. Allowed transitions: [${allowed.join(', ')}]`,
      );
    }
  }

  generateTrackingNumber(carrier?: string): string {
    const prefix = carrier ? carrier.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) : 'TRK';
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomHex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
    return `${prefix}-${timestamp}-${randomHex}`;
  }

  calculateShippingCost(dto: CalculateShippingCostDto): number {
    return this.costCalculator.calculate({
      weightKg: dto.weightKg,
      distanceKm: dto.distanceKm,
      orderSubtotal: dto.orderSubtotal,
      carrier: dto.carrier,
      serviceLevel: dto.serviceLevel,
    });
  }

  async listShipments(query?: PaginationQueryDto) {
    const tenantId = this.getTenantId();
    const take = query?.take || 20;
    const skip = query?.skip || 0;
    return this.db.exec(async (tx) => {
      const [items, total] = await Promise.all([
        tx.shipment.findMany({
          where: { tenantId },
          include: {
            order: true,
            history: { orderBy: { timestamp: 'desc' } },
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

  async getShipment(id: string) {
    const tenantId = this.getTenantId();
    const cacheKey = `tenant:${tenantId}:shipment:${id}`;

    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    const shipment = await this.db.exec(async (tx) => {
      return tx.shipment.findFirst({
        where: { id, tenantId },
        include: {
          order: true,
          history: { orderBy: { timestamp: 'desc' } },
        },
      });
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    await this.cache.set(cacheKey, shipment, 300);
    return shipment;
  }

  async createShipment(dto: CreateShipmentDto) {
    const tenantId = this.getTenantId();
    const strategy = this.resolveCarrierStrategy(dto.carrier);

    const shipment = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: dto.orderId, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
      }

      const res = await strategy.createShipment(dto.orderId, dto.serviceLevel, dto.metadata);
      const trackingNumber = dto.trackingNumber || res.trackingNumber || this.generateTrackingNumber(strategy.carrierName);

      const calculatedCost = this.calculateShippingCost({
        carrier: strategy.carrierName,
        serviceLevel: dto.serviceLevel,
        orderSubtotal: Number(order.subtotal),
      });

      const created = await tx.shipment.create({
        data: {
          tenantId,
          storeId: order.storeId,
          orderId: dto.orderId,
          fulfillmentId: dto.fulfillmentId || null,
          carrier: strategy.carrierName,
          serviceLevel: dto.serviceLevel || 'STANDARD',
          trackingNumber,
          shippingLabelReference: res.shippingLabelReference || null,
          estimatedDeliveryDate: res.estimatedDeliveryDate || null,
          shippingCost: calculatedCost,
          status: ShipmentStatus.PREPARED,
          metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
          history: {
            create: {
              tenantId,
              status: ShipmentStatus.PREPARED,
              carrierStatus: res.carrierStatus || 'PREPARED',
              location: 'Warehouse Dispatch',
              notes: 'Shipment created and prepared for label generation',
            },
          },
        },
        include: { history: true },
      });

      return created;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${shipment.id}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentCreated',
      tenantId,
      shipmentId: shipment.id,
      orderId: shipment.orderId,
      carrier: shipment.carrier,
      trackingNumber: shipment.trackingNumber,
      occurredAt: new Date(),
    });

    return shipment;
  }

  async assignCarrier(shipmentId: string, carrier: string) {
    const tenantId = this.getTenantId();
    const strategy = this.resolveCarrierStrategy(carrier);

    const updated = await this.db.exec(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!shipment) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      return tx.shipment.update({
        where: { id: shipmentId },
        data: { carrier: strategy.carrierName },
      });
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${shipmentId}`);
    return updated;
  }

  async generateShippingLabel(shipmentId: string) {
    const tenantId = this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!shipment) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      this.validateStatusTransition(shipment.status, ShipmentStatus.LABEL_GENERATED);

      const strategy = this.resolveCarrierStrategy(shipment.carrier);
      const labelRes = await strategy.generateLabel(shipment.trackingNumber);

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          shippingLabelReference: labelRes.labelReference,
          status: ShipmentStatus.LABEL_GENERATED,
        },
      });

      await tx.shipmentTrackingHistory.create({
        data: {
          tenantId,
          shipmentId,
          status: ShipmentStatus.LABEL_GENERATED,
          carrierStatus: 'LABEL_GENERATED',
          location: 'Dispatch Office',
          notes: `Label generated: ${labelRes.labelReference}`,
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${shipmentId}`);

    await this.eventPublisher.publish({
      eventType: 'LabelGenerated',
      tenantId,
      shipmentId: result.id,
      orderId: result.orderId,
      carrier: result.carrier,
      trackingNumber: result.trackingNumber,
      payload: { labelReference: result.shippingLabelReference },
      occurredAt: new Date(),
    });

    return result;
  }

  async markShipped(shipmentId: string) {
    const tenantId = this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!shipment) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      this.validateStatusTransition(shipment.status, ShipmentStatus.SHIPPED);

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: ShipmentStatus.SHIPPED,
          shippedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: shipment.orderId },
        data: { status: OrderStatus.SHIPPED, fulfillmentStatus: FulfillmentStatus.FULFILLED },
      });

      await tx.shipmentTrackingHistory.create({
        data: {
          tenantId,
          shipmentId,
          status: ShipmentStatus.SHIPPED,
          carrierStatus: 'DISPATCHED',
          location: 'Origin Facility',
          notes: 'Shipment dispatched to carrier network',
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${shipmentId}`);
    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${result.orderId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentDispatched',
      tenantId,
      shipmentId: result.id,
      orderId: result.orderId,
      carrier: result.carrier,
      trackingNumber: result.trackingNumber,
      occurredAt: new Date(),
    });

    return result;
  }

  async updateTrackingStatus(shipmentId: string, dto: UpdateTrackingDto) {
    const tenantId = this.getTenantId();

    const result = await this.db.exec(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!shipment) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      this.validateStatusTransition(shipment.status, dto.status);

      const updateData: Prisma.ShipmentUpdateInput = { status: dto.status };
      if (dto.status === ShipmentStatus.DELIVERED) {
        updateData.deliveredAt = new Date();
      }

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: updateData,
      });

      await tx.shipmentTrackingHistory.create({
        data: {
          tenantId,
          shipmentId,
          status: dto.status,
          carrierStatus: dto.carrierStatus || dto.status,
          location: dto.location || 'In Transit',
          notes: dto.notes || `Tracking update: ${dto.status}`,
        },
      });

      if (dto.status === ShipmentStatus.DELIVERED) {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: OrderStatus.DELIVERED },
        });
      }

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${shipmentId}`);
    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${result.orderId}`);

    const eventType = dto.status === ShipmentStatus.DELIVERED
      ? 'ShipmentDelivered'
      : dto.status === ShipmentStatus.IN_TRANSIT
      ? 'ShipmentInTransit'
      : 'ShipmentDispatched';

    await this.eventPublisher.publish({
      eventType,
      tenantId,
      shipmentId: result.id,
      orderId: result.orderId,
      carrier: result.carrier,
      trackingNumber: result.trackingNumber,
      payload: { location: dto.location, notes: dto.notes },
      occurredAt: new Date(),
    });

    return result;
  }

  async confirmDelivery(shipmentId: string) {
    return this.updateTrackingStatus(shipmentId, {
      status: ShipmentStatus.DELIVERED,
      carrierStatus: 'DELIVERED',
      notes: 'Delivery confirmed by customer signature',
    });
  }

  async initiateReturnShipment(dto: InitiateReturnShipmentDto) {
    const tenantId = this.getTenantId();
    const carrier = dto.carrier || 'mock';
    const strategy = this.resolveCarrierStrategy(carrier);

    const returnShipment = await this.db.exec(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: dto.orderId, tenantId },
      });
      if (!order) {
        throw new NotFoundException(`Order with ID ${dto.orderId} not found`);
      }

      const res = await strategy.createReturnShipment(dto.orderId, dto.originalTrackingNumber);

      const created = await tx.shipment.create({
        data: {
          tenantId,
          storeId: order.storeId,
          orderId: dto.orderId,
          carrier: strategy.carrierName,
          trackingNumber: res.trackingNumber,
          shippingLabelReference: res.shippingLabelReference,
          status: ShipmentStatus.PREPARED,
          shippingCost: res.shippingCost || 10,
          history: {
            create: {
              tenantId,
              status: ShipmentStatus.PREPARED,
              carrierStatus: 'RETURN_PREPARED',
              location: 'Customer Address',
              notes: `Return shipment initiated. Reason: ${dto.reason || 'N/A'}`,
            },
          },
        },
        include: { history: true },
      });

      await tx.order.update({
        where: { id: dto.orderId },
        data: { status: OrderStatus.RETURNED, fulfillmentStatus: FulfillmentStatus.RETURNED },
      });

      return created;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${returnShipment.id}`);
    await this.cache.invalidatePattern(`tenant:${tenantId}:order:${returnShipment.orderId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentReturned',
      tenantId,
      shipmentId: returnShipment.id,
      orderId: returnShipment.orderId,
      carrier: returnShipment.carrier,
      trackingNumber: returnShipment.trackingNumber,
      payload: { reason: dto.reason },
      occurredAt: new Date(),
    });

    return returnShipment;
  }

  async cancelShipment(shipmentId: string) {
    const tenantId = this.getTenantId();

    const cancelled = await this.db.exec(async (tx) => {
      const shipment = await tx.shipment.findFirst({
        where: { id: shipmentId, tenantId },
      });
      if (!shipment) {
        throw new NotFoundException(`Shipment with ID ${shipmentId} not found`);
      }

      this.validateStatusTransition(shipment.status, ShipmentStatus.CANCELLED);

      const strategy = this.resolveCarrierStrategy(shipment.carrier);
      await strategy.cancelShipment(shipment.trackingNumber);

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: { status: ShipmentStatus.CANCELLED },
      });

      await tx.shipmentTrackingHistory.create({
        data: {
          tenantId,
          shipmentId,
          status: ShipmentStatus.CANCELLED,
          carrierStatus: 'CANCELLED',
          notes: 'Shipment cancelled prior to dispatch',
        },
      });

      return updated;
    });

    await this.cache.invalidatePattern(`tenant:${tenantId}:shipment:${shipmentId}`);

    await this.eventPublisher.publish({
      eventType: 'ShipmentCancelled',
      tenantId,
      shipmentId: cancelled.id,
      orderId: cancelled.orderId,
      carrier: cancelled.carrier,
      trackingNumber: cancelled.trackingNumber,
      occurredAt: new Date(),
    });

    return cancelled;
  }
}
