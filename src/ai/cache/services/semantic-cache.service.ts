import { Injectable, Logger } from '@nestjs/common';
import { MemoryCacheProvider } from '../providers/memory-cache.provider';
import { CacheKeyGenerator } from './cache-key-generator.service';
import { CacheMetricsService } from './cache-metrics.service';
import { CachePolicyManager } from './cache-policy-manager.service';
import { SimilarityMatcher } from './similarity-matcher.service';
import { CacheInvalidationService } from './cache-invalidation.service';
import { CacheCategory } from '../dto/cache-category.dto';
import { SemanticCacheRequest, SemanticCacheResponse } from '../dto/cache-result.dto';

@Injectable()
export class SemanticCacheService {
  private readonly logger = new Logger(SemanticCacheService.name);

  constructor(
    private readonly provider: MemoryCacheProvider,
    private readonly keyGenerator: CacheKeyGenerator,
    private readonly metrics: CacheMetricsService,
    private readonly policyManager: CachePolicyManager,
    private readonly matcher: SimilarityMatcher,
    private readonly invalidation: CacheInvalidationService,
  ) {}

  async get<T>(request: SemanticCacheRequest): Promise<SemanticCacheResponse<T>> {
    const startTime = Date.now();
    const key = this.keyGenerator.generateKey(
      request.category,
      request.organizationId,
      request.query,
    );

    const exact = await this.provider.get<T>(key, request.organizationId);
    if (exact) {
      this.metrics.recordHit(request.category, Date.now() - startTime);
      return {
        hit: true,
        value: exact.value,
        key: exact.key,
        latency: Date.now() - startTime,
        score: 1.0,
        matchedQuery: request.query,
      };
    }

    const minScore = request.minSimilarity ?? 0.85;
    const similar = await this.matcher.findSimilar(
      request.query,
      request.organizationId,
      request.category,
      {
        minScore,
        maxResults: request.maxResults ?? 1,
        useSemanticFallback: request.useSemanticFallback ?? true,
      },
    );

    if (similar.length > 0 && similar[0].score >= minScore) {
      this.metrics.recordSemanticHit(request.category, Date.now() - startTime);
      return {
        hit: true,
        value: similar[0].value as T,
        key: similar[0].key,
        latency: Date.now() - startTime,
        score: similar[0].score,
        matchedQuery: request.query,
      };
    }

    this.metrics.recordMiss(request.category, Date.now() - startTime);
    return {
      hit: false,
      key,
      latency: Date.now() - startTime,
    };
  }

  async set<T>(
    category: CacheCategory,
    query: string,
    value: T,
    organizationId: string,
    tags?: string[],
  ): Promise<string> {
    const startTime = Date.now();
    const key = this.keyGenerator.generateKey(category, organizationId, query);
    const policy = this.policyManager.getPolicy(category);

    const size = await this.provider.getSize();
    if (this.policyManager.shouldEvict(category, size)) {
      const entries = this.provider.getAllEntries(organizationId, category).map((e) => ({
        key: e.key,
        metadata: {
          accessedAt: e.metadata.accessedAt,
          accessCount: e.metadata.accessCount,
          createdAt: e.metadata.createdAt,
        },
      }));
      const candidates = this.policyManager.selectEvictionCandidates(
        category,
        entries,
        Math.ceil(size * 0.2),
      );
      for (const candidateKey of candidates) {
        await this.provider.delete(candidateKey, organizationId);
        this.metrics.recordEviction(category);
      }
    }

    await this.provider.set(key, value, organizationId, category, {
      ttl: policy.defaultTtlMs,
      slidingTtl: policy.slidingWindowMs,
      tags,
    });

    this.metrics.recordSave(category, Date.now() - startTime);
    return key;
  }

  async getOrSet<T>(
    request: SemanticCacheRequest,
    compute: () => Promise<T>,
    tags?: string[],
  ): Promise<SemanticCacheResponse<T>> {
    const cached = await this.get<T>(request);
    if (cached.hit) return cached;

    const value = await compute();
    await this.set(request.category, request.query, value, request.organizationId, tags);

    return {
      hit: false,
      value,
      key: cached.key,
      latency: Date.now(),
    };
  }

  async invalidate(category: CacheCategory, organizationId: string, key?: string): Promise<number> {
    if (key) {
      const cacheKey = this.keyGenerator.generateKey(category, organizationId, key);
      await this.invalidation.invalidateByKey(cacheKey, organizationId);
      return 1;
    }
    return this.invalidation.invalidateByCategory(category, organizationId);
  }

  async invalidateByTags(tags: string[], organizationId: string): Promise<number> {
    return this.invalidation.invalidateByTags(tags, organizationId);
  }

  async clear(organizationId?: string): Promise<number> {
    if (organizationId) {
      return this.invalidation.invalidateAll(organizationId);
    }
    await this.provider.clear();
    return 0;
  }

  async getMetrics() {
    return this.metrics.getMetrics();
  }
}
