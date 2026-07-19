export { CacheModule } from './cache.module';
export { SemanticCacheService } from './services/semantic-cache.service';
export { EmbeddingCacheService } from './services/embedding-cache.service';
export { CacheInvalidationService } from './services/cache-invalidation.service';
export { CacheMetricsService } from './services/cache-metrics.service';
export { CacheKeyGenerator } from './services/cache-key-generator.service';
export { CachePolicyManager } from './services/cache-policy-manager.service';
export { SimilarityMatcher } from './services/similarity-matcher.service';
export { MemoryCacheProvider } from './providers/memory-cache.provider';
export {
  ICacheProvider,
  CacheEntry,
  CacheEntryMetadata,
  CacheOptions,
} from './interfaces/cache-provider.interface';
export {
  ISimilarityMatcher,
  SimilarityResult,
  MatchOptions,
} from './interfaces/similarity.interface';
export {
  ICachePolicyManager,
  CachePolicy,
  CachePolicyConfig,
  EvictionStrategy,
} from './interfaces/policy.interface';
export { ICacheInvalidationService, InvalidationEvent } from './interfaces/invalidation.interface';
export { ICacheKeyGenerator, CacheKeyParts } from './interfaces/key-generator.interface';
export {
  ICacheMetricsService,
  CacheMetrics,
  CategoryMetrics,
} from './interfaces/metrics.interface';
export { CacheError, CacheErrorCode } from './interfaces/cache-error.interface';
export { CacheCategory, CACHE_CATEGORIES } from './dto/cache-category.dto';
export { CacheResult, SemanticCacheRequest, SemanticCacheResponse } from './dto/cache-result.dto';
