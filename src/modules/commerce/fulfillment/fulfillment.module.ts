import { Module } from '@nestjs/common';
import { FulfillmentService } from './fulfillment.service.js';
import { FulfillmentController } from './fulfillment.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { FulfillmentEventPublisher } from './events/fulfillment-event-publisher.service.js';
import { LoggingModule } from '../../../infrastructure/logging/logging.module.js';

@Module({
  imports: [IdentityModule, LoggingModule],
  controllers: [FulfillmentController],
  providers: [FulfillmentService, FulfillmentEventPublisher],
  exports: [FulfillmentService, FulfillmentEventPublisher],
})
export class FulfillmentModule {}
