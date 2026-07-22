export interface WebhookVerifier {
  readonly providerName: string;
  readonly aliases?: string[];
  verifySignature(rawPayload: string, signature: string, secret: string): boolean;
}
