import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { ProductSearchIndexRepository } from '../repositories/product-search-index.repository.js';
import { CacheService } from '../../../../infrastructure/cache/cache.service.js';
import { IsString, IsUUID, IsOptional, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class BrandRenameJobPayload {
  @IsUUID()
  tenantId!: string;

  @IsUUID()
  brandId!: string;

  @IsString()
  @IsOptional()
  correlationId?: string;
}

@Processor('search_indexing_queue', { concurrency: 3 })
export class BrandRenameWorker extends WorkerHost {
  constructor(
    private readonly logger: AppLogger,
    private readonly db: TenantPrismaService,
    private readonly searchIndex: ProductSearchIndexRepository,
    private readonly cache: CacheService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const payload = plainToInstance(BrandRenameJobPayload, job.data);
    const errors = validateSync(payload);
    if (errors.length > 0) {
      const msg = errors.map(e => Object.values(e.constraints || {})).flat().join(', ');
      this.logger.error(`Invalid job payload for ${job.id}: ${msg}`, '', 'BrandRenameWorker');
      throw new Error(`Invalid job payload: ${msg}`);
    }

    const { tenantId, brandId, correlationId } = payload;
    const logCtx = `Job ${job.id} | Tenant ${tenantId} | Brand ${brandId}`;

    this.logger.log(`Starting brand rename fan-out: ${logCtx}`, 'BrandRenameWorker');

    // 1. Verify brand exists (and is not deleted) using tenant-scoped context
    const brandExists = await this.db.runAsTenant(tenantId, async (tx) => {
      return tx.brand.findFirst({
        where: { id: brandId, tenantId },
      });
    });

    if (!brandExists) {
      this.logger.log(`Brand missing or deleted. No-op: ${logCtx}`, 'BrandRenameWorker');
      return { success: true, processed: 0, reason: 'brand_missing' };
    }

    // 2. Process products in batches using stable keyset pagination
    const BATCH_SIZE = 100;
    // Note: The user requested that we do NOT rely on job progress to resume.
    // "On every retry: restart pagination from the beginning... rely on idempotent refresh behavior"
    // "job.updateProgress may be used only for observability"
    let cursor = '';
    let processedCount = 0;

    let hasMore = true;

    while (hasMore) {
      // Fetch next batch of product IDs
      const products = await this.db.runAsTenant(tenantId, async (tx) => {
        return tx.product.findMany({
          where: {
            tenantId,
            brandId,
            ...(cursor ? { id: { gt: cursor } } : {}),
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        });
      });

      if (products.length === 0) {
        hasMore = false;
        break;
      }

      this.logger.log(`Processing batch of ${products.length} products... ${logCtx}`, 'BrandRenameWorker');

      // Refresh each product in its own transaction
      for (const product of products) {
        const attempt = job.attemptsMade + 1;

        try {
          await this.db.runAsTenant(tenantId, async (tx) => {
            await this.searchIndex.refreshProductVector(tx, tenantId, product.id);
          });

          processedCount++;
          cursor = product.id;
        } catch (error: any) {
          this.logger.error(
            `Product refresh failed in batch. Product: ${product.id}, Attempt: ${attempt}, ${logCtx}`,
            error.stack,
            'BrandRenameWorker'
          );
          // Update progress so we can observe how far it got before failure
          await job.updateProgress({ processed: processedCount, lastProcessedId: cursor });
          throw error; // Rethrow to let BullMQ retry policy handle it
        }
      }

      await job.updateProgress({ processed: processedCount, lastProcessedId: cursor });
    }

    this.logger.log(`Completed fan-out. Total processed: ${processedCount}. ${logCtx}`, 'BrandRenameWorker');

    // 3. Cache invalidation
    try {
      await this.cache.invalidateKeys(`tenant:${tenantId}:product-keys`);
    } catch (cacheError: any) {
      this.logger.warn(
        `Failed to invalidate cache after successful fan-out. ${logCtx}`,
        'BrandRenameWorker'
      );
    }

    return { success: true, processed: processedCount };
  }
}
