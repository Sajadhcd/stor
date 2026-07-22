export interface CouponResult {
  valid: boolean;
  discountAmount: number;
  message?: string;
}

export interface CouponVerifier {
  verifyAndCalculateDiscount(couponCode: string, subtotal: number): Promise<CouponResult>;
}
