export interface PaymentGatewayInterface {
  createPayment(amount: number, currency: string, referenceId: string): Promise<{ transactionId: string; status: string; redirectUrl?: string }>;
  verifyPayment(transactionId: string): Promise<{ success: boolean; status: string }>;
  refundPayment(transactionId: string, amount: number): Promise<{ success: boolean; refundId: string }>;
}
