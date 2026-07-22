import { Injectable } from '@nestjs/common';
import { ShippingCostCalculator, ShippingCostRequest } from './shipping-cost-calculator.interface.js';

@Injectable()
export class DefaultShippingCostCalculator implements ShippingCostCalculator {
  calculate(req: ShippingCostRequest): number {
    // Free shipping threshold (subtotal >= $150)
    if (req.orderSubtotal && req.orderSubtotal >= 150) {
      return 0;
    }

    let cost = 10; // Base flat rate

    if (req.weightKg && req.weightKg > 1) {
      cost += (req.weightKg - 1) * 2; // $2 per additional kg
    }

    if (req.distanceKm && req.distanceKm > 50) {
      cost += Math.floor((req.distanceKm - 50) / 50) * 3; // $3 per 50km
    }

    return Number(cost.toFixed(2));
  }
}
