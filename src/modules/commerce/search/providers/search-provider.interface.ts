export interface SearchOptions {
  query: string;
  limit?: number;
  offset?: number;
  storeId?: string;
  categoryId?: string;
  brandId?: string;
  isPublished?: boolean;
}

export interface SearchResultItem {
  id: string;
  score: number;
}

export interface SearchResult {
  items: SearchResultItem[];
  total: number;
}

export interface SearchProvider {
  search(tenantId: string, options: SearchOptions): Promise<SearchResult>;
  refreshProductVector(productId: string): Promise<void>;
  refreshAllProductVectors(tenantId: string): Promise<void>;
}

export const SEARCH_PROVIDER_TOKEN = 'SEARCH_PROVIDER_TOKEN';
