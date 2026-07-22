import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class OrderNumberGenerator {
  /**
   * Generates a collision-resistant, database-safe, scalable order number.
   * Format: ORD-{YYYYMMDD}-{RANDOM_HEX_6}
   */
  generateOrderNumber(storePrefix?: string): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const prefix = storePrefix ? storePrefix.toUpperCase().replace(/[^A-Z0-9]/g, '') : 'ORD';
    return `${prefix}-${dateStr}-${randomHex}`;
  }
}
