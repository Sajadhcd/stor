import { Injectable } from '@nestjs/common';
import { PaymentGatewayStrategy, PaymentResponse } from './payment-gateway-strategy.interface.js';
import * as crypto from 'crypto';

@Injectable()
export class AsiaHawalaPaymentStrategy implements PaymentGatewayStrategy {
  readonly providerName = 'asiahawala';
  readonly aliases = ['asiahawala', 'asia-hawala', 'asia'];

  async createPayment(amount: number, currency: string, orderId: string, metadata?: Record<string, unknown>): Promise<PaymentResponse> {
    const paymentReference = `AH-${orderId.slice(0, 8)}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    return {
      success: true,
      paymentReference,
      externalTransactionId: `TX-AH-${Date.now()}`,
      status: 'PENDING',
      rawResponse: { provider: 'asiahawala', orderId, amount, currency, metadata },
    };
  }

  async verifyPayment(paymentReference: string, externalTransactionId?: string): Promise<PaymentResponse> {
    return {
      success: true,
      paymentReference,
      externalTransactionId: externalTransactionId || `TX-AH-${Date.now()}`,
      status: 'PAID',
    };
  }

  async refundPayment(paymentReference: string, amount: number, reason?: string): Promise<PaymentResponse> {
    return {
      success: true,
      paymentReference,
      externalTransactionId: `REF-AH-${Date.now()}`,
      status: 'REFUNDED',
      rawResponse: { amount, reason },
    };
  }

  async cancelPayment(paymentReference: string): Promise<PaymentResponse> {
    return {
      success: true,
      paymentReference,
      status: 'CANCELLED',
    };
  }

  normalizeResponse(raw: Record<string, unknown>): PaymentResponse {
    const status = String(raw.status || 'PAID').toUpperCase();
    return {
      success: status === 'PAID' || status === 'SUCCESS',
      paymentReference: String(raw.paymentReference || raw.payment_reference || ''),
      externalTransactionId: raw.transactionId ? String(raw.transactionId) : undefined,
      status: status === 'PAID' || status === 'SUCCESS' ? 'PAID' : 'FAILED',
      rawResponse: raw,
    };
  }
}
