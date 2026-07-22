import { Injectable } from '@nestjs/common';
import { TaxCalculator } from './tax-calculator.interface.js';

@Injectable()
export class DefaultTaxCalculator implements TaxCalculator {
  async calculateTax(subtotal: number, shippingAddress?: Record<string, unknown>): Promise<number> {
    if (subtotal <= 0) return 0;
    // Standard 15% VAT / Sales Tax
    return Math.round(subtotal * 0.15 * 100) / 100;
  }
}
