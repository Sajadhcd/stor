import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { WebhookSecurityService } from './webhook-security.service.js';
import { WebhookVerifier } from './webhook-verifier.interface.js';
import { ConfigService } from '../../../../infrastructure/config/config.service.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';

describe('WebhookSecurityService', () => {
  let service: WebhookSecurityService;
  let verifierRegistry: Map<string, WebhookVerifier>;
  let configService: jest.Mocked<ConfigService>;
  let cacheService: jest.Mocked<CacheService>;
  let loggerService: jest.Mocked<AppLogger>;
  let mockVerifier: jest.Mocked<WebhookVerifier>;

  beforeEach(async () => {
    mockVerifier = {
      providerName: 'qicard',
      aliases: ['qi-card'],
      verifySignature: jest.fn().mockReturnValue(true),
    };

    verifierRegistry = new Map<string, WebhookVerifier>();
    verifierRegistry.set('qicard', mockVerifier);
    verifierRegistry.set('qi-card', mockVerifier);

    const mockConfig = {
      getWebhookSecret: jest.fn().mockReturnValue('test-secret-value'),
    };

    const mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookSecurityService,
        { provide: 'WEBHOOK_VERIFIER_REGISTRY', useValue: verifierRegistry },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CacheService, useValue: mockCache },
        { provide: AppLogger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get<WebhookSecurityService>(WebhookSecurityService);
    configService = module.get(ConfigService);
    cacheService = module.get(CacheService);
    loggerService = module.get(AppLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyAndProtect', () => {
    const validPayload = { id: 'evt-999', amount: 500, timestamp: Math.floor(Date.now() / 1000) };
    const rawBody = JSON.stringify(validPayload);
    const validSig = 'valid_hex_signature';

    it('should successfully verify valid webhook, check replay cache, and store event with 86400s TTL', async () => {
      const result = await service.verifyAndProtect('qicard', rawBody, validSig, undefined, validPayload);

      expect(result).toEqual({ eventId: 'evt-999', provider: 'qicard' });
      expect(mockVerifier.verifySignature).toHaveBeenCalledWith(rawBody, validSig, 'test-secret-value');
      expect(cacheService.get).toHaveBeenCalledWith('payment:webhook:qicard:evt-999');
      expect(cacheService.set).toHaveBeenCalledWith(
        'payment:webhook:qicard:evt-999',
        expect.objectContaining({ provider: 'qicard', eventId: 'evt-999' }),
        86400,
      );
    });

    it('should resolve provider alias cleanly via registry without if/else chains', async () => {
      const result = await service.verifyAndProtect('qi-card', rawBody, validSig, undefined, validPayload);
      expect(result.provider).toBe('qicard');
    });

    it('should throw BadRequestException for unsupported provider', async () => {
      await expect(
        service.verifyAndProtect('unknown-provider', rawBody, validSig, undefined, validPayload),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw UnauthorizedException if secret is not configured for provider', async () => {
      configService.getWebhookSecret.mockReturnValueOnce('');
      await expect(
        service.verifyAndProtect('qicard', rawBody, validSig, undefined, validPayload),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if signature verification fails', async () => {
      mockVerifier.verifySignature.mockReturnValueOnce(false);
      await expect(
        service.verifyAndProtect('qicard', rawBody, 'bad-signature', undefined, validPayload),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should throw UnauthorizedException if timestamp is missing or non-numeric', async () => {
      const invalidPayload = { id: 'evt-999', amount: 500 };
      await expect(
        service.verifyAndProtect('qicard', JSON.stringify(invalidPayload), validSig, undefined, invalidPayload),
      ).rejects.toThrow('Missing or invalid webhook timestamp');
    });

    it('should throw UnauthorizedException if timestamp drift > 300 seconds into the future', async () => {
      const futureTs = Math.floor(Date.now() / 1000) + 400;
      const futurePayload = { id: 'evt-999', timestamp: futureTs };
      await expect(
        service.verifyAndProtect('qicard', JSON.stringify(futurePayload), validSig, undefined, futurePayload),
      ).rejects.toThrow('Webhook request from future timestamp rejected');
    });

    it('should throw UnauthorizedException if timestamp drift is expired (< -300 seconds)', async () => {
      const expiredTs = Math.floor(Date.now() / 1000) - 400;
      const expiredPayload = { id: 'evt-999', timestamp: expiredTs };
      await expect(
        service.verifyAndProtect('qicard', JSON.stringify(expiredPayload), validSig, undefined, expiredPayload),
      ).rejects.toThrow('Webhook request expired');
    });

    it('should throw BadRequestException if payload missing event id', async () => {
      const noIdPayload = { amount: 500, timestamp: Math.floor(Date.now() / 1000) };
      await expect(
        service.verifyAndProtect('qicard', JSON.stringify(noIdPayload), validSig, undefined, noIdPayload),
      ).rejects.toThrow('Missing event ID in webhook payload');
    });

    it('should throw UnauthorizedException if duplicate event ID is found in Redis (replay attack prevention)', async () => {
      cacheService.get.mockResolvedValueOnce({ processedAt: new Date().toISOString(), provider: 'qicard' });
      await expect(
        service.verifyAndProtect('qicard', rawBody, validSig, undefined, validPayload),
      ).rejects.toThrow('Replay attack prevented: duplicate webhook event ID');
    });
  });
});
