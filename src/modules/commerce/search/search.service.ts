import { Inject, Injectable } from '@nestjs/common';
import { SEARCH_PROVIDER_TOKEN } from './providers/search-provider.interface.js';
import type { SearchProvider, SearchOptions, SearchResult } from './providers/search-provider.interface.js';

/**
 * SearchService mediates search requests to the active search provider.
 * 
 * Note: Write-path synchronization (automatic updates of search vectors
 * on product modifications) is scheduled to be implemented in Phase C1-B2.
 * Currently, updates should be triggered manually via `refreshProductVector`
 * or `refreshAllProductVectors`.
 */
@Injectable()
export class SearchService {
  constructor(
    @Inject(SEARCH_PROVIDER_TOKEN)
    private readonly provider: SearchProvider,
  ) {}

  async search(tenantId: string, options: SearchOptions): Promise<SearchResult> {
    return this.provider.search(tenantId, options);
  }

  async refreshProductVector(productId: string): Promise<void> {
    return this.provider.refreshProductVector(productId);
  }

  async refreshAllProductVectors(tenantId: string): Promise<void> {
    return this.provider.refreshAllProductVectors(tenantId);
  }
}
