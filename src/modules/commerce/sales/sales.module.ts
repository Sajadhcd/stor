import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { OrderNumberGenerator } from './services/order-number-generator.service.js';
import { OrderEventPublisher } from './events/order-event-publisher.service.js';
import { LoggingModule } from '../../../infrastructure/logging/logging.module.js';

@Module({
  imports: [IdentityModule, LoggingModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderNumberGenerator, OrderEventPublisher],
  exports: [OrdersService, OrderNumberGenerator, OrderEventPublisher],
})
export class SalesModule {}
