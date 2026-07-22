import { Injectable } from '@nestjs/common';
import { CouponVerifier, CouponResult } from './coupon-verifier.interface.js';

@Injectable()
export class DefaultCouponVerifier implements CouponVerifier {
  async verifyAndCalculateDiscount(couponCode: string, subtotal: number): Promise<CouponResult> {
    if (!couponCode || subtotal <= 0) {
      return { valid: false, discountAmount: 0, message: 'Invalid subtotal or empty coupon' };
    }

    const code = couponCode.trim().toUpperCase();

    if (code === 'SAVE10') {
      const discount = Math.round(subtotal * 0.1 * 100) / 100;
      return { valid: true, discountAmount: discount, message: '10% discount applied' };
    }

    if (code === 'FLAT20') {
      const discount = Math.min(20, subtotal);
      return { valid: true, discountAmount: discount, message: '$20 discount applied' };
    }

    if (code === 'WELCOME50') {
      const discount = Math.round(subtotal * 0.5 * 100) / 100;
      return { valid: true, discountAmount: discount, message: '50% welcome discount applied' };
    }

    return { valid: false, discountAmount: 0, message: `Coupon code ${couponCode} is invalid or expired` };
  }
}
