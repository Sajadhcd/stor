import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhookVerifier } from './webhook-verifier.interface.js';

@Injectable()
export class ZainCashVerifier implements WebhookVerifier {
  readonly providerName = 'zaincash';
  readonly aliases = ['zain-cash', 'zain'];

  verifySignature(rawPayload: string, signature: string, secret: string): boolean {
    if (!signature || !secret || typeof rawPayload !== 'string') {
      return false;
    }

    const computed = crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');
    return this.safeCompare(computed, signature);
  }

  private safeCompare(expected: string, actual: string): boolean {
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(actual);

    if (expectedBuf.length !== actualBuf.length) {
      crypto.timingSafeEqual(expectedBuf, expectedBuf);
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }
}
