export interface PaymentResponse {
  success: boolean;
  paymentReference: string;
  externalTransactionId?: string;
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  failureReason?: string;
  rawResponse?: Record<string, unknown>;
}

export interface PaymentGatewayStrategy {
  readonly providerName: string;
  readonly aliases: string[];
  createPayment(amount: number, currency: string, orderId: string, metadata?: Record<string, unknown>): Promise<PaymentResponse>;
  verifyPayment(paymentReference: string, externalTransactionId?: string): Promise<PaymentResponse>;
  refundPayment(paymentReference: string, amount: number, reason?: string): Promise<PaymentResponse>;
  cancelPayment(paymentReference: string): Promise<PaymentResponse>;
  normalizeResponse(raw: Record<string, unknown>): PaymentResponse;
}
