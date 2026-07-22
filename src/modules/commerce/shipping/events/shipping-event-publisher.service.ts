import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';

export interface ShippingDomainEvent {
  eventType:
    | 'ShipmentCreated'
    | 'LabelGenerated'
    | 'ShipmentDispatched'
    | 'ShipmentInTransit'
    | 'ShipmentDelivered'
    | 'ShipmentReturned'
    | 'ShipmentCancelled';
  tenantId: string;
  shipmentId: string;
  orderId: string;
  carrier: string;
  trackingNumber: string;
  payload?: Record<string, unknown>;
  occurredAt: Date;
}

@Injectable()
export class ShippingEventPublisher {
  constructor(private readonly logger: AppLogger) {}

  async publish(event: ShippingDomainEvent): Promise<void> {
    this.logger.log(
      `[DomainEvent] ${event.eventType} published for Shipment ${event.shipmentId} (Tracking: ${event.trackingNumber}, Carrier: ${event.carrier})`,
      'ShippingEventPublisher',
    );
  }
}
