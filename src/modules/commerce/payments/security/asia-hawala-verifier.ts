import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { WebhookVerifier } from './webhook-verifier.interface.js';

@Injectable()
export class AsiaHawalaVerifier implements WebhookVerifier {
  readonly providerName = 'asiahawala';
  readonly aliases = ['asia-hawala', 'asia'];

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
