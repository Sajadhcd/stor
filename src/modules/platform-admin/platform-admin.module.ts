import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module.js';
import { TenantAdminService } from './tenants/tenant-admin.service.js';
import { TenantAdminController } from './tenants/tenant-admin.controller.js';
import { SubscriptionsService } from './subscriptions/subscriptions.service.js';
import { SubscriptionsController } from './subscriptions/subscriptions.controller.js';
import { PlatformAnalyticsService } from './analytics/platform-analytics.service.js';
import { PlatformAnalyticsController } from './analytics/platform-analytics.controller.js';
import { SystemHealthService } from './health/system-health.service.js';
import { SystemHealthController } from './health/system-health.controller.js';

@Module({
  imports: [IdentityModule],
  controllers: [
    TenantAdminController,
    SubscriptionsController,
    PlatformAnalyticsController,
    SystemHealthController,
  ],
  providers: [
    TenantAdminService,
    SubscriptionsService,
    PlatformAnalyticsService,
    SystemHealthService,
  ],
  exports: [
    TenantAdminService,
    SubscriptionsService,
    PlatformAnalyticsService,
    SystemHealthService,
  ],
})
export class PlatformAdminModule {}
