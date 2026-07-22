import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';

export interface OrderDomainEvent {
  eventType: 'OrderCreated' | 'OrderCancelled' | 'PaymentStatusUpdated' | 'FulfillmentStatusUpdated';
  tenantId: string;
  orderId: string;
  orderNumber: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

@Injectable()
export class OrderEventPublisher {
  constructor(private readonly logger: AppLogger) {}

  async publish(event: OrderDomainEvent): Promise<void> {
    this.logger.log(
      `[DomainEvent] ${event.eventType} published for Order ${event.orderNumber} (Tenant: ${event.tenantId})`,
      'OrderEventPublisher',
    );
    // Extensible hook for BullMQ event queue / Webhook emitters
  }
}
