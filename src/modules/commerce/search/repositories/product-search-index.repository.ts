import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppLogger } from '../../../../infrastructure/logging/logger.service.js';
import { requestContextStorage } from '../../../../common/context/request-context.js';

/**
 * ProductSearchIndexRepository owns all FTS write operations.
 *
 * Design contract:
 *  - Every method accepts the CALLER'S Prisma.TransactionClient.
 *  - It never opens a new transaction or calls db.exec().
 *  - Failures are rethrown as ServiceUnavailableException so the caller
 *    transaction rolls back automatically.
 *  - SQL details and identifiers are never exposed in the HTTP response.
 *  - All SQL is parameterized via Prisma.sql / $executeRaw -- no RawUnsafe.
 */
@Injectable()
export class ProductSearchIndexRepository {
  constructor(private readonly logger: AppLogger) {}

  /**
   * Refresh the FTS tsvector for one product inside the caller's transaction.
   *
   * The underlying SQL function:
   *   - holds a FOR UPDATE lock on the product row before reading search fields
   *   - enforces tenant_id on every table access (products, brands, product_variants)
   *   - only indexes active variants (is_active = true)
   *   - silently no-ops if the product/tenant combination does not exist
   *
   * Because this runs inside the caller's transaction, a failure here causes
   * the parent write (product create/update/variant change) to roll back.
   */
  async refreshProductVector(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
  ): Promise<void> {
    const ctx = requestContextStorage.getStore();
    const correlationId = ctx?.correlationId ?? 'unknown';

    try {
      await tx.$executeRaw`
        SELECT update_product_search_vector(${tenantId}::uuid, ${productId}::uuid)
      `;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `FTS vector refresh failed [tenantId=${tenantId} productId=${productId} correlationId=${correlationId}]: ${message}`,
        err instanceof Error ? err.stack : undefined,
        'ProductSearchIndexRepository',
      );
      // Throw a generic exception — the SQL error is never forwarded to the client.
      // Because this runs in the caller's tx, the throw causes an automatic rollback.
      throw new ServiceUnavailableException(
        'Search index refresh failed. The write has been rolled back.',
      );
    }
  }
}
