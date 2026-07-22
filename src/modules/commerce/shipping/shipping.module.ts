import { Module } from '@nestjs/common';
import { ShippingService } from './shipping.service.js';
import { ShippingController } from './shipping.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { DhlCarrierStrategy } from './strategies/dhl-carrier.strategy.js';
import { FedexCarrierStrategy } from './strategies/fedex-carrier.strategy.js';
import { AramexCarrierStrategy } from './strategies/aramex-carrier.strategy.js';
import { MockCarrierStrategy } from './strategies/mock-carrier.strategy.js';
import { CarrierStrategy } from './strategies/carrier-strategy.interface.js';
import { DefaultShippingCostCalculator } from './calculators/default-shipping-cost.calculator.js';
import { ShippingEventPublisher } from './events/shipping-event-publisher.service.js';
import { LoggingModule } from '../../../infrastructure/logging/logging.module.js';

@Module({
  imports: [IdentityModule, LoggingModule],
  controllers: [ShippingController],
  providers: [
    ShippingService,
    ShippingEventPublisher,
    DhlCarrierStrategy,
    FedexCarrierStrategy,
    AramexCarrierStrategy,
    MockCarrierStrategy,
    DefaultShippingCostCalculator,
    {
      provide: 'SHIPPING_COST_CALCULATOR',
      useClass: DefaultShippingCostCalculator,
    },
    {
      provide: 'CARRIER_STRATEGY_REGISTRY',
      useFactory: (
        dhl: DhlCarrierStrategy,
        fedex: FedexCarrierStrategy,
        aramex: AramexCarrierStrategy,
        mock: MockCarrierStrategy,
      ) => {
        const registry = new Map<string, CarrierStrategy>();
        for (const strategy of [dhl, fedex, aramex, mock]) {
          registry.set(strategy.carrierName.toLowerCase(), strategy);
          for (const alias of strategy.aliases) {
            registry.set(alias.toLowerCase(), strategy);
          }
        }
        return registry;
      },
      inject: [DhlCarrierStrategy, FedexCarrierStrategy, AramexCarrierStrategy, MockCarrierStrategy],
    },
  ],
  exports: [ShippingService, ShippingEventPublisher, 'SHIPPING_COST_CALCULATOR', 'CARRIER_STRATEGY_REGISTRY'],
})
export class ShippingModule {}
