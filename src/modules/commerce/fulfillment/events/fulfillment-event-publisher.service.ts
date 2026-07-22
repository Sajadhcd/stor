import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';

export interface FulfillmentDomainEvent {
  eventType:
    | 'InventoryReserved'
    | 'InventoryCommitted'
    | 'InventoryReleased'
    | 'ShipmentPrepared'
    | 'ShipmentShipped'
    | 'ShipmentDelivered'
    | 'OrderCompleted'
    | 'InventoryRestocked';
  tenantId: string;
  orderId: string;
  shipmentId?: string;
  warehouseId?: string;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

@Injectable()
export class FulfillmentEventPublisher {
  constructor(private readonly logger: AppLogger) {}

  async publish(event: FulfillmentDomainEvent): Promise<void> {
    this.logger.log(
      `[DomainEvent] ${event.eventType} published for Order ${event.orderId} (Tenant: ${event.tenantId})`,
      'FulfillmentEventPublisher',
    );
  }
}
