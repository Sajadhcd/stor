import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';

export interface PaymentDomainEvent {
  eventType: 'PaymentCreated' | 'PaymentInitiated' | 'PaymentSucceeded' | 'PaymentFailed' | 'PaymentCancelled' | 'PaymentRefunded';
  tenantId: string;
  paymentId: string;
  orderId: string;
  provider: string;
  amount: number;
  currency: string;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class PaymentEventPublisher {
  constructor(private readonly logger: AppLogger) {}

  async publish(event: PaymentDomainEvent): Promise<void> {
    this.logger.log(
      `[DomainEvent] ${event.eventType} published for Payment ${event.paymentId} (Order: ${event.orderId}, Provider: ${event.provider})`,
      'PaymentEventPublisher',
    );
  }
}
