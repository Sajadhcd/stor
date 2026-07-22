export interface ShippingCalculator {
  calculateShipping(
    shippingMethodCode: string,
    itemsCount: number,
    destinationAddress?: Record<string, unknown>,
  ): Promise<number>;
}
