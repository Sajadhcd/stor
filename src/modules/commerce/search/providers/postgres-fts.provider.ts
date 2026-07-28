import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import type { SearchProvider, SearchOptions, SearchResult, SearchResultItem } from './search-provider.interface.js';
import { Prisma } from '@prisma/client';
import { requestContextStorage } from '../../../../common/context/request-context.js';

@Injectable()
export class PostgresFtsProvider implements SearchProvider {
  constructor(private readonly db: TenantPrismaService) {}

  async search(tenantId: string, options: SearchOptions): Promise<SearchResult> {
    const {
      query,
      limit = 20,
      offset = 0,
      storeId,
      categoryId,
      brandId,
      isPublished,
    } = options;

    if (!query || !query.trim()) {
      return { items: [], total: 0 };
    }

    const trimmedQuery = query.trim();

    return this.db.exec(async (tx) => {
      // 1. Build where conditions as Prisma.Sql fragments.
      // Enforce tenant isolation in the raw query.
      const conditions: Prisma.Sql[] = [
        Prisma.sql`p.tenant_id = ${tenantId}::uuid`,
        Prisma.sql`p.deleted_at IS NULL`,
      ];

      // Enforce optional store_id in the query
      if (storeId) {
        conditions.push(Prisma.sql`p.store_id = ${storeId}::uuid`);
      }

      if (brandId) {
        conditions.push(Prisma.sql`p.brand_id = ${brandId}::uuid`);
      }

      if (isPublished !== undefined) {
        conditions.push(Prisma.sql`p.is_published = ${isPublished}`);
      }

      if (categoryId) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM categories_products cp 
          WHERE cp.product_id = p.id 
            AND cp.category_id = ${categoryId}::uuid
        )`);
      }

      // Add full text search vector condition
      conditions.push(Prisma.sql`(
        p.tsv_search @@ websearch_to_tsquery('english', ${trimmedQuery}) OR
        p.tsv_search @@ websearch_to_tsquery('simple', normalize_arabic(${trimmedQuery}))
      )`);

      const whereClause = Prisma.join(conditions, ' AND ');

      // Total count query
      const countQuery = Prisma.sql`
        SELECT COUNT(*)::int as count 
        FROM products p 
        WHERE ${whereClause}
      `;

      const countRes = await tx.$queryRaw<Array<{ count: number }>>(countQuery);
      const total = countRes[0]?.count || 0;

      if (total === 0) {
        return { items: [], total: 0 };
      }

      // Ranked search query
      const selectQuery = Prisma.sql`
        SELECT p.id::text as id,
          (ts_rank(p.tsv_search, websearch_to_tsquery('english', ${trimmedQuery})) +
           ts_rank(p.tsv_search, websearch_to_tsquery('simple', normalize_arabic(${trimmedQuery}))))::float as rank
        FROM products p
        WHERE ${whereClause}
        ORDER BY rank DESC, p.id ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const rows = await tx.$queryRaw<Array<{ id: string; rank: number }>>(selectQuery);

      const items: SearchResultItem[] = rows.map((r) => ({
        id: r.id,
        score: r.rank,
      }));

      return { items, total };
    });
  }

  async refreshProductVector(productId: string): Promise<void> {
    // Note: this standalone method is retained for backward-compatible manual/admin calls.
    // Write-path synchronization inside product transactions uses
    // ProductSearchIndexRepository.refreshProductVector(tx, tenantId, productId) instead.
    //
    // The nexio_app role no longer has EXECUTE on the 1-argument form; this method
    // therefore requires tenantId to call the 2-argument form. We read it from
    // the request context, which is set by TenantMiddleware for all HTTP requests.
    const ctx = requestContextStorage.getStore();
    const tenantId = ctx?.tenantId;
    if (!tenantId) {
      throw new Error(
        'refreshProductVector requires a tenant context (app.current_tenant_id). ' +
        'Call from a request context or use ProductSearchIndexRepository inside a transaction.',
      );
    }
    await this.db.exec(async (tx) => {
      await tx.$executeRaw`SELECT update_product_search_vector(${tenantId}::uuid, ${productId}::uuid)`;
    });
  }

  async refreshAllProductVectors(tenantId: string): Promise<void> {
    await this.db.exec(async (tx) => {
      // Iterate per product and call the 2-argument tenant-safe function.
      const products = await tx.product.findMany({
        where: { tenantId },
        select: { id: true },
      });
      for (const p of products) {
        await tx.$executeRaw`SELECT update_product_search_vector(${tenantId}::uuid, ${p.id}::uuid)`;
      }
    });
  }
}
