import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Base Prisma service connecting with full DATABASE_URL credentials.
 * Used for:
 *   - Authentication lookups (bypasses RLS intentionally — auth is pre-authentication)
 *   - Health checks
 *   - Admin operations (migrations, seeds)
 *
 * All tenant-scoped queries use TenantPrismaService instead, which wraps every
 * call inside a transaction that first sets app.current_tenant_id, activating
 * the PostgreSQL RLS policies.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
