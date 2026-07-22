import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { WebhookSecurityService } from './security/webhook-security.service.js';
import { QiCardPaymentStrategy } from './strategies/qi-card-payment.strategy.js';
import { ZainCashPaymentStrategy } from './strategies/zain-cash-payment.strategy.js';
import { AsiaHawalaPaymentStrategy } from './strategies/asia-hawala-payment.strategy.js';
import { MockPaymentStrategy } from './strategies/mock-payment.strategy.js';
import { PaymentGatewayStrategy } from './strategies/payment-gateway-strategy.interface.js';
import { PaymentEventPublisher } from './events/payment-event-publisher.service.js';
import { LoggingModule } from '../../../infrastructure/logging/logging.module.js';
import { QiCardVerifier } from './security/qi-card-verifier.js';
import { ZainCashVerifier } from './security/zain-cash-verifier.js';
import { AsiaHawalaVerifier } from './security/asia-hawala-verifier.js';
import { WebhookVerifier } from './security/webhook-verifier.interface.js';

@Module({
  imports: [IdentityModule, LoggingModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    WebhookSecurityService,
    PaymentEventPublisher,
    QiCardPaymentStrategy,
    ZainCashPaymentStrategy,
    AsiaHawalaPaymentStrategy,
    MockPaymentStrategy,
    QiCardVerifier,
    ZainCashVerifier,
    AsiaHawalaVerifier,
    {
      provide: 'PAYMENT_STRATEGY_REGISTRY',
      useFactory: (
        qi: QiCardPaymentStrategy,
        zain: ZainCashPaymentStrategy,
        asia: AsiaHawalaPaymentStrategy,
        mock: MockPaymentStrategy,
      ) => {
        const registry = new Map<string, PaymentGatewayStrategy>();
        for (const strategy of [qi, zain, asia, mock]) {
          registry.set(strategy.providerName.toLowerCase(), strategy);
          for (const alias of strategy.aliases) {
            registry.set(alias.toLowerCase(), strategy);
          }
        }
        return registry;
      },
      inject: [QiCardPaymentStrategy, ZainCashPaymentStrategy, AsiaHawalaPaymentStrategy, MockPaymentStrategy],
    },
    {
      provide: 'WEBHOOK_VERIFIER_REGISTRY',
      useFactory: (
        qi: QiCardVerifier,
        zain: ZainCashVerifier,
        asia: AsiaHawalaVerifier,
      ) => {
        const registry = new Map<string, WebhookVerifier>();
        for (const verifier of [qi, zain, asia]) {
          registry.set(verifier.providerName.toLowerCase(), verifier);
          if (verifier.aliases) {
            for (const alias of verifier.aliases) {
              registry.set(alias.toLowerCase(), verifier);
            }
          }
        }
        return registry;
      },
      inject: [QiCardVerifier, ZainCashVerifier, AsiaHawalaVerifier],
    },
  ],
  exports: [
    PaymentsService,
    WebhookSecurityService,
    PaymentEventPublisher,
    'PAYMENT_STRATEGY_REGISTRY',
    'WEBHOOK_VERIFIER_REGISTRY',
  ],
})
export class PaymentsModule {}

