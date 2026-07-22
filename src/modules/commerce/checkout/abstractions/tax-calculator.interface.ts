export interface TaxCalculator {
  calculateTax(subtotal: number, shippingAddress?: Record<string, unknown>): Promise<number>;
}
