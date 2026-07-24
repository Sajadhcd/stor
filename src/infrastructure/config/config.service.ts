import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private readonly nestConfigService: NestConfigService) {}

  get port(): number {
    return this.nestConfigService.get<number>('PORT', 3001);
  }

  get databaseUrl(): string {
    const url = this.nestConfigService.get<string>('DATABASE_URL');
    if (!url) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }
    return url;
  }

  /**
   * Non-superuser application database URL.
   * nexio_app is subject to PostgreSQL Row-Level Security (RLS) policies.
   */
  get appDatabaseUrl(): string {
    const url = this.nestConfigService.get<string>('APP_DATABASE_URL');
    if (!url) {
      throw new Error('APP_DATABASE_URL is not defined in environment variables');
    }
    return url;
  }

  get jwtSecret(): string {
    return this.nestConfigService.get<string>(
      'JWT_SECRET',
      'nexio_secret_access_key_change_me_in_production',
    );
  }

  get jwtRefreshSecret(): string {
    return this.nestConfigService.get<string>(
      'JWT_REFRESH_SECRET',
      'nexio_secret_refresh_key_change_me_in_production',
    );
  }

  get redisUrl(): string {
    const url = this.nestConfigService.get<string>('REDIS_URL');
    if (!url) {
      throw new Error('REDIS_URL is not defined in environment variables');
    }
    return url;
  }

  get redisNamespace(): string {
    return this.nestConfigService.get<string>('REDIS_NAMESPACE', 'nexio:cache:');
  }

  get redisDefaultTtl(): number {
    return this.nestConfigService.get<number>('REDIS_DEFAULT_TTL', 300);
  }

  get rateLimitTtl(): number {
    return this.nestConfigService.get<number>('RATE_LIMIT_TTL', 60);
  }

  get rateLimitLimit(): number {
    return this.nestConfigService.get<number>('RATE_LIMIT_LIMIT', 60);
  }

  get corsOrigins(): string[] {
    const origins = this.nestConfigService.get<string>('CORS_ORIGINS');
    if (origins) {
      return origins
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
    }
    const isProd = this.nestConfigService.get<string>('NODE_ENV') === 'production';
    if (isProd) {
      return [];
    }
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ];
  }

  validateSecrets(): void {
    const isProd = this.nestConfigService.get<string>('NODE_ENV') === 'production';
    const defaultSecret = 'nexio_secret_access_key_change_me_in_production';
    const defaultRefreshSecret = 'nexio_secret_refresh_key_change_me_in_production';

    const jwtSecretVal = this.nestConfigService.get<string>('JWT_SECRET');
    const jwtRefreshSecretVal = this.nestConfigService.get<string>('JWT_REFRESH_SECRET');

    const hasDefaultSecret =
      !jwtSecretVal || jwtSecretVal === defaultSecret || this.jwtSecret === defaultSecret;
    const hasDefaultRefresh =
      !jwtRefreshSecretVal ||
      jwtRefreshSecretVal === defaultRefreshSecret ||
      this.jwtRefreshSecret === defaultRefreshSecret;

    if (isProd && (hasDefaultSecret || hasDefaultRefresh)) {
      throw new Error(
        'FATAL STARTUP EXCEPTION: Production environment cannot use default JWT_SECRET or JWT_REFRESH_SECRET',
      );
    }
    if (
      this.nestConfigService.get<string>('STRICT_SECURITY') === 'true' &&
      (hasDefaultSecret || hasDefaultRefresh)
    ) {
      throw new Error(
        'FATAL STARTUP EXCEPTION: Default JWT secrets forbidden under STRICT_SECURITY',
      );
    }
  }

  getWebhookSecret(provider: string): string {
    const envKey = `WEBHOOK_SECRET_${provider.toUpperCase().replace(/-/g, '_')}`;
    const defaultSecret = `default_${provider.toLowerCase().replace(/-/g, '_')}_secret`;
    return this.nestConfigService.get<string>(envKey, defaultSecret);
  }
}
