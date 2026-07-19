export {
  ICacheProvider,
  CacheEntry,
  CacheEntryMetadata,
  CacheOptions,
} from './cache-provider.interface';
export { ISimilarityMatcher, SimilarityResult, MatchOptions } from './similarity.interface';
export {
  ICachePolicyManager,
  CachePolicy,
  CachePolicyConfig,
  EvictionStrategy,
} from './policy.interface';
export { ICacheInvalidationService, InvalidationEvent } from './invalidation.interface';
export { ICacheKeyGenerator, CacheKeyParts } from './key-generator.interface';
export { ICacheMetricsService, CacheMetrics, CategoryMetrics } from './metrics.interface';
export { CacheError, CacheErrorCode } from './cache-error.interface';
export { CacheCategory } from '../dto/cache-category.dto';
