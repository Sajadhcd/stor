import { Module } from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { CheckoutController } from './checkout.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { DefaultTaxCalculator } from './abstractions/default-tax-calculator.js';
import { DefaultShippingCalculator } from './abstractions/default-shipping-calculator.js';
import { DefaultCouponVerifier } from './abstractions/default-coupon-verifier.js';

@Module({
  imports: [IdentityModule],
  controllers: [CheckoutController],
  providers: [
    CheckoutService,
    { provide: 'TAX_CALCULATOR', useClass: DefaultTaxCalculator },
    { provide: 'SHIPPING_CALCULATOR', useClass: DefaultShippingCalculator },
    { provide: 'COUPON_VERIFIER', useClass: DefaultCouponVerifier },
  ],
  exports: [CheckoutService],
})
export class CheckoutModule {}
