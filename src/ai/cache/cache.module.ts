import { Module, Global } from '@nestjs/common';
import { MemoryCacheProvider } from './providers/memory-cache.provider';
import { CacheKeyGenerator } from './services/cache-key-generator.service';
import { CachePolicyManager } from './services/cache-policy-manager.service';
import { CacheInvalidationService } from './services/cache-invalidation.service';
import { CacheMetricsService } from './services/cache-metrics.service';
import { SimilarityMatcher } from './services/similarity-matcher.service';
import { SemanticCacheService } from './services/semantic-cache.service';
import { EmbeddingCacheService } from './services/embedding-cache.service';

@Global()
@Module({
  providers: [
    MemoryCacheProvider,
    CacheKeyGenerator,
    CachePolicyManager,
    CacheInvalidationService,
    CacheMetricsService,
    SimilarityMatcher,
    SemanticCacheService,
    EmbeddingCacheService,
  ],
  exports: [
    MemoryCacheProvider,
    SemanticCacheService,
    EmbeddingCacheService,
    CacheInvalidationService,
    CacheMetricsService,
    CacheKeyGenerator,
    CachePolicyManager,
    SimilarityMatcher,
  ],
})
export class CacheModule {}
