import { Injectable } from '@nestjs/common';
import { ShippingCalculator } from './shipping-calculator.interface.js';

@Injectable()
export class DefaultShippingCalculator implements ShippingCalculator {
  async calculateShipping(
    shippingMethodCode: string,
    itemsCount: number,
    destinationAddress?: Record<string, unknown>,
  ): Promise<number> {
    if (itemsCount <= 0) return 0;
    const code = shippingMethodCode.toLowerCase();
    if (code.includes('express')) {
      return 25.0;
    }
    if (code.includes('free')) {
      return 0.0;
    }
    return 10.0; // Standard shipping fee
  }
}
