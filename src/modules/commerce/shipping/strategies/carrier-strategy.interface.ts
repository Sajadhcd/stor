export interface CarrierShipmentResponse {
  success: boolean;
  trackingNumber: string;
  shippingLabelReference: string;
  carrierStatus: string;
  estimatedDeliveryDate?: Date;
  shippingCost?: number;
  rawResponse?: Record<string, unknown>;
}

export interface CarrierStrategy {
  readonly carrierName: string;
  readonly aliases: string[];
  createShipment(orderId: string, serviceLevel?: string, metadata?: Record<string, unknown>): Promise<CarrierShipmentResponse>;
  generateLabel(trackingNumber: string): Promise<{ labelReference: string; pdfUrl?: string }>;
  getTrackingUpdates(trackingNumber: string): Promise<{ carrierStatus: string; normalizedStatus: string; location?: string; notes?: string }>;
  confirmDelivery(trackingNumber: string): Promise<{ success: boolean; deliveredAt: Date }>;
  cancelShipment(trackingNumber: string): Promise<{ success: boolean }>;
  createReturnShipment(orderId: string, originalTrackingNumber?: string): Promise<CarrierShipmentResponse>;
}
