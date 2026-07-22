import { Injectable } from '@nestjs/common';

@Injectable()
export class CurrencyService {
  private readonly usdToIqdRate = 1310;

  formatMoney(amount: number, currency: 'IQD' | 'USD' = 'IQD'): string {
    const formatted = Math.floor(amount).toLocaleString('ar-IQ');
    if (currency === 'IQD') {
      return `${formatted} د.ع`;
    }
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }

  getExchangeRate(from: string = 'USD', to: string = 'IQD'): number {
    if (from === 'USD' && to === 'IQD') return this.usdToIqdRate;
    if (from === 'IQD' && to === 'USD') return 1 / this.usdToIqdRate;
    return 1;
  }

  convertCurrency(amount: number, from: string, to: string): number {
    const rate = this.getExchangeRate(from, to);
    return amount * rate;
  }
}
