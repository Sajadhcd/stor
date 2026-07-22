import { Injectable } from '@nestjs/common';
import { PaymentGatewayInterface } from '../interfaces/payment-gateway.interface.js';

@Injectable()
export class QiCardService implements PaymentGatewayInterface {
  async createPayment(amount: number, currency: string, referenceId: string) {
    return {
      transactionId: `QI-${Date.now()}`,
      status: 'INITIATED',
      redirectUrl: `https://qicard.iq/pay?ref=${referenceId}`,
    };
  }

  async verifyPayment(transactionId: string) {
    return { success: true, status: 'CAPTURED' };
  }

  async refundPayment(transactionId: string, amount: number) {
    return { success: true, refundId: `QI-REF-${Date.now()}` };
  }
}

@Injectable()
export class ZainCashService implements PaymentGatewayInterface {
  async createPayment(amount: number, currency: string, referenceId: string) {
    return {
      transactionId: `ZC-${Date.now()}`,
      status: 'INITIATED',
      redirectUrl: `https://zaincash.iq/pay?ref=${referenceId}`,
    };
  }

  async verifyPayment(transactionId: string) {
    return { success: true, status: 'CAPTURED' };
  }

  async refundPayment(transactionId: string, amount: number) {
    return { success: true, refundId: `ZC-REF-${Date.now()}` };
  }
}

@Injectable()
export class AsiaHawalaService implements PaymentGatewayInterface {
  async createPayment(amount: number, currency: string, referenceId: string) {
    return {
      transactionId: `AH-${Date.now()}`,
      status: 'INITIATED',
      redirectUrl: `https://asiahawala.iq/pay?ref=${referenceId}`,
    };
  }

  async verifyPayment(transactionId: string) {
    return { success: true, status: 'CAPTURED' };
  }

  async refundPayment(transactionId: string, amount: number) {
    return { success: true, refundId: `AH-REF-${Date.now()}` };
  }
}
