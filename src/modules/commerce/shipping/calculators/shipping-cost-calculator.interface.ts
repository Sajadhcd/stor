export interface ShippingCostRequest {
  weightKg?: number;
  distanceKm?: number;
  orderSubtotal?: number;
  carrier?: string;
  serviceLevel?: string;
}

export interface ShippingCostCalculator {
  calculate(req: ShippingCostRequest): number;
}
