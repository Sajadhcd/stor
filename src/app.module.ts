import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './infrastructure/config/config.module.js';
import { ConfigService } from './infrastructure/config/config.service.js';
import { LoggingModule } from './infrastructure/logging/logging.module.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { JobsModule } from './infrastructure/jobs/jobs.module.js';
import { HealthModule } from './infrastructure/health/health.module.js';
import { RedisModule } from './infrastructure/cache/redis.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SaasCoreModule } from './modules/saas-core/saas-core.module.js';
import { CommerceModule } from './modules/commerce/commerce.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { PlatformAdminModule } from './modules/platform-admin/platform-admin.module.js';
import { TenantMiddleware } from './common/middleware/tenant.middleware.js';
import { MetricsController } from './infrastructure/metrics/metrics.controller.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.rateLimitTtl * 1000,
          limit: config.rateLimitLimit,
        },
      ],
    }),
    LoggingModule,
    DatabaseModule,
    JobsModule,
    HealthModule,
    RedisModule,
    IdentityModule,
    SaasCoreModule,
    CommerceModule,
    AnalyticsModule,
    PlatformAdminModule,
  ],
  controllers: [MetricsController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}

