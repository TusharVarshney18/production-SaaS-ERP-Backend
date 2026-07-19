import { CacheCategory } from './cache-category.dto';

export interface CacheResult<T = unknown> {
  hit: boolean;
  semantic: boolean;
  value?: T;
  key: string;
  latency: number;
  score?: number;
}

export interface SemanticCacheRequest {
  query: string;
  category: CacheCategory;
  organizationId: string;
  userId: string;
  minSimilarity?: number;
  maxResults?: number;
  useSemanticFallback?: boolean;
  metadata?: Record<string, unknown>;
}

export interface SemanticCacheResponse<T = unknown> {
  hit: boolean;
  value?: T;
  key: string;
  latency: number;
  score?: number;
  matchedQuery?: string;
}
