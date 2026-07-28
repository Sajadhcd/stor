import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../../../../infrastructure/database/tenant-prisma.service.js';
import { ProductQueryDto } from '../dto/product-query.dto.js';

export interface CatalogSearchOptions {
  query: string;
  storeId?: string;
  categoryId?: string;
  brandId?: string;
  brandSlug?: string;
  isPublished?: boolean;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  attributes?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  take?: number;
  skip?: number;
}

export interface CatalogSearchResult {
  items: { id: string; score: number }[];
  total: number;
}

@Injectable()
export class CatalogSearchRepository {
  constructor(private readonly db: TenantPrismaService) {}

  /**
   * Builds and executes the full text search query combining FTS ranking with Catalog filters.
   * Tolerates empty normalized queries by returning empty results without querying.
   */
  async searchRankedProductIds(
    tx: Prisma.TransactionClient,
    tenantId: string,
    options: CatalogSearchOptions,
    attributeDefinitions: { name: string }[]
  ): Promise<CatalogSearchResult> {
    const { query } = options;
    const trimmedQuery = query?.trim();

    if (!trimmedQuery) {
      return { items: [], total: 0 };
    }

    try {
      // We will first check if the DB helper returns an empty tsquery
      // since plainto_tsquery strips symbols. If it does, we return empty.
      const queryCheck = await tx.$queryRaw<Array<{ is_empty: boolean }>>`
        SELECT (build_catalog_search_query(${trimmedQuery}::text) = ''::tsquery) as is_empty
      `;
      if (queryCheck[0]?.is_empty) {
        return { items: [], total: 0 };
      }

      // Base conditions
      const conditions: Prisma.Sql[] = [
        Prisma.sql`p.tenant_id = ${tenantId}::uuid`,
        Prisma.sql`p.deleted_at IS NULL`,
        Prisma.sql`p.tsv_search @@ build_catalog_search_query(${trimmedQuery}::text)`,
      ];

      if (options.storeId) {
        conditions.push(Prisma.sql`p.store_id = ${options.storeId}::uuid`);
      }

      if (options.brandId) {
        conditions.push(Prisma.sql`p.brand_id = ${options.brandId}::uuid`);
      }

      if (options.brandSlug) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM brands b
          WHERE b.id = p.brand_id AND b.slug = ${options.brandSlug}
        )`);
      }

      if (options.isPublished !== undefined) {
        conditions.push(Prisma.sql`p.is_published = ${options.isPublished}`);
      }

      if (options.categoryId) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM categories_products cp
          WHERE cp.product_id = p.id AND cp.category_id = ${options.categoryId}::uuid
        )`);
      }

      // Variant-level existence checks (Price, Stock, Attributes)
      const variantConditions: Prisma.Sql[] = [
        Prisma.sql`pv.product_id = p.id`,
        Prisma.sql`pv.tenant_id = p.tenant_id`,
        Prisma.sql`pv.is_active = true`
      ];

      if (options.minPrice !== undefined) {
        variantConditions.push(Prisma.sql`pv.price >= ${options.minPrice}`);
      }

      if (options.maxPrice !== undefined) {
        variantConditions.push(Prisma.sql`pv.price <= ${options.maxPrice}`);
      }

      if (options.inStockOnly) {
        variantConditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM inventory_stock_levels sl
          WHERE sl.variant_id = pv.id AND sl.quantity_physical > 0
        )`);
      }

      if (options.attributes && Object.keys(options.attributes).length > 0) {
        // Build JSONB containment checks. Each entry must match as a whole key/value pair.
        const attrConditions: Prisma.Sql[] = [];
        for (const [key, val] of Object.entries(options.attributes)) {
          // Safely parameterize the JSONB containment check
          attrConditions.push(Prisma.sql`pv.attributes @> ${JSON.stringify({ [key]: val })}::jsonb`);
        }
        if (attrConditions.length > 0) {
          variantConditions.push(Prisma.join(attrConditions, ' AND '));
        }
      }

      // Only add the variant EXISTS clause if we actually have variant filters beyond the base ones
      // Wait, minPrice/maxPrice etc. requires matching AT LEAST ONE variant that satisfies ALL variant criteria together!
      if (options.minPrice !== undefined || options.maxPrice !== undefined || options.inStockOnly || (options.attributes && Object.keys(options.attributes).length > 0)) {
        conditions.push(Prisma.sql`EXISTS (
          SELECT 1 FROM product_variants pv
          WHERE ${Prisma.join(variantConditions, ' AND ')}
        )`);
      }

      const whereClause = Prisma.join(conditions, ' AND ');

      // Total count query
      const countQuery = Prisma.sql`
        SELECT COUNT(*)::int as count
        FROM products p
        WHERE ${Prisma.join(conditions, ' AND ')}
      `;

      const countRes = await tx.$queryRaw<Array<{ count: number }>>(countQuery);
      const total = countRes[0]?.count || 0;

      if (total === 0) {
        return { items: [], total: 0 };
      }

      const take = options.take || 20;
      const skip = options.skip || 0;

      // Ranking expression
      const rankSelect = Prisma.sql`ts_rank_cd(p.tsv_search, build_catalog_search_query(${trimmedQuery}::text)) AS rank`;

      // Sorting
      let sortClause = Prisma.sql`ORDER BY rank DESC, p.id ASC`;
      const allowListedSorts = ['price', 'created_at', 'title'];
      const sortBy = options.sortBy === 'price_asc' || options.sortBy === 'price_desc' ? 'price' : options.sortBy;
      const sortOrder = options.sortBy === 'price_asc' ? 'ASC' : (options.sortBy === 'price_desc' ? 'DESC' : (options.sortOrder === 'asc' ? 'ASC' : 'DESC'));

      if (sortBy && allowListedSorts.includes(sortBy)) {
        if (sortBy === 'price') {
          sortClause = sortOrder === 'ASC'
            ? Prisma.sql`ORDER BY ep.effective_price ASC NULLS LAST, rank DESC, p.id ASC`
            : Prisma.sql`ORDER BY ep.effective_price DESC NULLS LAST, rank DESC, p.id ASC`;
        } else if (sortBy === 'created_at') {
          sortClause = sortOrder === 'ASC'
            ? Prisma.sql`ORDER BY p.created_at ASC, rank DESC, p.id ASC`
            : Prisma.sql`ORDER BY p.created_at DESC, rank DESC, p.id ASC`;
        } else if (sortBy === 'title') {
          sortClause = sortOrder === 'ASC'
            ? Prisma.sql`ORDER BY p.title_translations->>'en' ASC, rank DESC, p.id ASC`
            : Prisma.sql`ORDER BY p.title_translations->>'en' DESC, rank DESC, p.id ASC`;
        }
      }

      // Fetch IDs
      const selectQuery = Prisma.sql`
        SELECT p.id::text as id, ${rankSelect}

        FROM products p
        LEFT JOIN LATERAL (
          SELECT MIN(pv.price) as effective_price
          FROM product_variants pv
          WHERE pv.product_id = p.id
            AND pv.tenant_id = p.tenant_id
            AND pv.is_active = true
        ) ep ON true
        WHERE ${whereClause}
        ${sortClause}
        LIMIT ${take} OFFSET ${skip}
      `;

      const rows = await tx.$queryRaw<Array<{ id: string; rank: number }>>(selectQuery);

      const items = rows.map((r) => ({
        id: r.id,
        score: r.rank,
      }));

      return { items, total };
    } catch (err) {
      throw new InternalServerErrorException(
        `CatalogSearchRepository: query failed — ${(err as Error).message}`,
      );
    }
  }
}
