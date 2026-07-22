import { QiCardVerifier } from './qi-card-verifier.js';
import { ZainCashVerifier } from './zain-cash-verifier.js';
import { AsiaHawalaVerifier } from './asia-hawala-verifier.js';
import * as crypto from 'crypto';

describe('Payment Webhook Verifiers', () => {
  const secret = 'super_secret_webhook_key_123';
  const rawBody = '{"event":"payment.captured","amount":1500,"orderId":"ORD-101"}';
  const validSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  describe('QiCardVerifier', () => {
    let verifier: QiCardVerifier;

    beforeEach(() => {
      verifier = new QiCardVerifier();
    });

    it('should verify correct HMAC SHA256 signature', () => {
      expect(verifier.verifySignature(rawBody, validSignature, secret)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      const wrongSignature = crypto.createHmac('sha256', 'wrong_secret').update(rawBody).digest('hex');
      expect(verifier.verifySignature(rawBody, wrongSignature, secret)).toBe(false);
    });

    it('should reject signature with different buffer length gracefully without throwing RangeError', () => {
      expect(verifier.verifySignature(rawBody, 'shortsig', secret)).toBe(false);
    });

    it('should return false if missing signature or secret', () => {
      expect(verifier.verifySignature(rawBody, '', secret)).toBe(false);
      expect(verifier.verifySignature(rawBody, validSignature, '')).toBe(false);
    });
  });

  describe('ZainCashVerifier', () => {
    let verifier: ZainCashVerifier;

    beforeEach(() => {
      verifier = new ZainCashVerifier();
    });

    it('should verify correct HMAC SHA256 signature', () => {
      expect(verifier.verifySignature(rawBody, validSignature, secret)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      expect(verifier.verifySignature(rawBody, 'bad_signature_value_1234567890abcdef', secret)).toBe(false);
    });
  });

  describe('AsiaHawalaVerifier', () => {
    let verifier: AsiaHawalaVerifier;

    beforeEach(() => {
      verifier = new AsiaHawalaVerifier();
    });

    it('should verify correct HMAC SHA256 signature', () => {
      expect(verifier.verifySignature(rawBody, validSignature, secret)).toBe(true);
    });

    it('should reject invalid HMAC signature', () => {
      expect(verifier.verifySignature(rawBody, 'invalid_hex', secret)).toBe(false);
    });
  });
});
