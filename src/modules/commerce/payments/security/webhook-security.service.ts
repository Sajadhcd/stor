import { Injectable, BadRequestException, UnauthorizedException, Inject } from '@nestjs/common';
import { WebhookVerifier } from './webhook-verifier.interface.js';
import { ConfigService } from '../../../../infrastructure/config/config.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';

@Injectable()
export class WebhookSecurityService {
  constructor(
    @Inject('WEBHOOK_VERIFIER_REGISTRY') private readonly verifierRegistry: Map<string, WebhookVerifier>,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Enterprise-grade webhook verification pipeline:
   * 1. Resolve verifier from registry without switch statements or if/else chains
   * 2. Load provider secret
   * 3. Verify HMAC timing-safe signature
   * 4. Verify timestamp (prevent replay & drift > 300 seconds)
   * 5. Verify event ID & enforce Redis replay protection (TTL 86400s)
   */
  async verifyAndProtect(
    provider: string,
    rawBody: string,
    signature?: string,
    timestampHeader?: string,
    payload?: Record<string, any>,
  ): Promise<{ eventId: string; provider: string }> {
    if (!provider) {
      throw new BadRequestException('Webhook provider is required');
    }

    const verifier = this.verifierRegistry.get(provider.toLowerCase());
    if (!verifier) {
      this.logger.warn(`Rejected webhook for unsupported provider: ${provider}`);
      throw new BadRequestException(`Unsupported webhook provider: ${provider}`);
    }

    const secret = this.config.getWebhookSecret(verifier.providerName);
    if (!secret) {
      this.logger.error(`Webhook secret not configured for provider: ${verifier.providerName}`);
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (!signature || !verifier.verifySignature(rawBody, signature, secret)) {
      this.logger.warn(`Security alert: invalid webhook signature attempt for provider ${verifier.providerName}`);
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const rawTimestamp = timestampHeader || payload?.timestamp || payload?.created_at || payload?.time;
    const ts = Number(rawTimestamp);
    if (!rawTimestamp || isNaN(ts) || ts <= 0) {
      this.logger.warn(`Security alert: missing or invalid timestamp for webhook from ${verifier.providerName}`);
      throw new UnauthorizedException('Missing or invalid webhook timestamp');
    }

    const tsSeconds = ts > 100000000000 ? Math.floor(ts / 1000) : ts;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const drift = tsSeconds - nowSeconds;

    if (drift < -300) {
      this.logger.warn(`Security alert: expired webhook timestamp (${drift}s drift) from ${verifier.providerName}`);
      throw new UnauthorizedException('Webhook request expired');
    }

    if (drift > 300) {
      this.logger.warn(`Security alert: future webhook timestamp (${drift}s drift) from ${verifier.providerName}`);
      throw new UnauthorizedException('Webhook request from future timestamp rejected');
    }

    const eventId = String(payload?.id || payload?.event_id || payload?.eventId || '');
    if (!eventId) {
      this.logger.warn(`Rejected webhook from ${verifier.providerName} missing event ID`);
      throw new BadRequestException('Missing event ID in webhook payload');
    }

    const replayKey = `payment:webhook:${verifier.providerName}:${eventId}`;
    const existingReplay = await this.cache.get(replayKey);
    if (existingReplay) {
      this.logger.warn(`Security alert: Replay attack attempt detected for event ${eventId} on ${verifier.providerName}`);
      throw new UnauthorizedException('Replay attack prevented: duplicate webhook event ID');
    }

    // Mark event ID as processed in Redis with 24 hours TTL (86400 seconds)
    await this.cache.set(
      replayKey,
      {
        processedAt: new Date().toISOString(),
        provider: verifier.providerName,
        eventId,
      },
      86400,
    );

    return { eventId, provider: verifier.providerName };
  }
}
