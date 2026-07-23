import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { ConfigService } from '../config/config.service.js';
import { requestContextStorage } from '../../common/context/request-context.js';

/**
 * Tenant-scoped Prisma service that owns its own non-superuser (nexio_app)
 * connection pool completely separate from PrismaService.
 *
 * Architecture rationale:
 *   - PrismaService (migration/admin role) → bypasses RLS → used for auth lookups only
 *   - TenantPrismaService (nexio_app) → subject to RLS → used for tenant data queries
 *
 * PostgreSQL superusers are ALWAYS exempt from Row-Level Security, even when
 * FORCE ROW LEVEL SECURITY is set. The only way to enforce RLS is to connect
 * as a non-superuser role (nexio_app), then set app.current_tenant_id inside a
 * transaction so the RLS policy can filter rows by tenant.
 *
 * Every call to exec() wraps the operation in a transaction that:
 *   1. Calls set_config('app.current_tenant_id', tenantId, true) — activates RLS filter
 *   2. Optionally sets user_id, client_ip, user_agent for the audit trigger functions
 *   3. Executes the caller's query
 *   4. Commits — set_config with txlocal=true resets automatically
 */
@Injectable()
export class TenantPrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly client: PrismaClient;

  constructor(private readonly config: ConfigService) {
    this.client = new PrismaClient({
      datasources: {
        db: {
          url: this.config.appDatabaseUrl,
        },
      },
    });
  }

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }

  async ping(): Promise<void> {
    await this.exec(async (tx) => {
      await tx.$queryRaw`SELECT 1`;
    });
  }

  /**
   * Execute a database operation inside a transaction with the tenant RLS context set.
   * The request context (tenantId, userId, etc.) is read from AsyncLocalStorage
   * which is populated by TenantMiddleware for every incoming HTTP request.
   */
  async exec<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const ctx = requestContextStorage.getStore();

    return this.client.$transaction(
      async (tx) => {
        if (ctx?.tenantId) {
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${ctx.tenantId}, true)`;
        }

        if (ctx?.userId) {
          await tx.$executeRaw`SELECT set_config('app.current_user_id', ${ctx.userId}, true)`;
        }

        if (ctx?.clientIp) {
          await tx.$executeRaw`SELECT set_config('app.current_client_ip', ${ctx.clientIp}, true)`;
        }

        if (ctx?.userAgent) {
          await tx.$executeRaw`SELECT set_config('app.current_user_agent', ${ctx.userAgent}, true)`;
        }

        return fn(tx);
      },
      {
        maxWait: 10_000,
        timeout: 30_000,
      },
    );
  }
}
