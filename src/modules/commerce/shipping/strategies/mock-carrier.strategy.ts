import { Injectable } from '@nestjs/common';
import { CarrierStrategy, CarrierShipmentResponse } from './carrier-strategy.interface.js';
import * as crypto from 'crypto';

@Injectable()
export class MockCarrierStrategy implements CarrierStrategy {
  readonly carrierName = 'mock';
  readonly aliases = ['mock', 'test', 'local', 'default'];

  async createShipment(orderId: string, serviceLevel?: string, metadata?: Record<string, unknown>): Promise<CarrierShipmentResponse> {
    const trackingNumber = `MOCK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      success: true,
      trackingNumber,
      shippingLabelReference: `LBL-MOCK-${trackingNumber}`,
      carrierStatus: 'PREPARED',
      estimatedDeliveryDate: new Date(Date.now() + 86400000 * 1),
      shippingCost: 10,
      rawResponse: { provider: 'mock', orderId, serviceLevel, metadata },
    };
  }

  async generateLabel(trackingNumber: string): Promise<{ labelReference: string; pdfUrl?: string }> {
    return {
      labelReference: `LBL-MOCK-${trackingNumber}`,
      pdfUrl: `https://labels.mock.com/${trackingNumber}.pdf`,
    };
  }

  async getTrackingUpdates(trackingNumber: string): Promise<{ carrierStatus: string; normalizedStatus: string; location?: string; notes?: string }> {
    return {
      carrierStatus: 'IN_TRANSIT',
      normalizedStatus: 'IN_TRANSIT',
      location: 'Local Logistics Hub',
      notes: 'Package in transit',
    };
  }

  async confirmDelivery(trackingNumber: string): Promise<{ success: boolean; deliveredAt: Date }> {
    return {
      success: true,
      deliveredAt: new Date(),
    };
  }

  async cancelShipment(trackingNumber: string): Promise<{ success: boolean }> {
    return { success: true };
  }

  async createReturnShipment(orderId: string, originalTrackingNumber?: string): Promise<CarrierShipmentResponse> {
    const trackingNumber = `RET-MOCK-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      success: true,
      trackingNumber,
      shippingLabelReference: `LBL-RET-MOCK-${trackingNumber}`,
      carrierStatus: 'PREPARED',
      estimatedDeliveryDate: new Date(Date.now() + 86400000 * 1),
      shippingCost: 10,
      rawResponse: { provider: 'mock', orderId, originalTrackingNumber },
    };
  }
}
