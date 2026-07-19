import { Injectable, Logger } from '@nestjs/common';
import { MemoryCacheProvider } from '../providers/memory-cache.provider';
import { CacheKeyGenerator } from './cache-key-generator.service';
import { CacheMetricsService } from './cache-metrics.service';
import { SimilarityMatcher } from './similarity-matcher.service';

@Injectable()
export class EmbeddingCacheService {
  private readonly logger = new Logger(EmbeddingCacheService.name);

  constructor(
    private readonly provider: MemoryCacheProvider,
    private readonly keyGenerator: CacheKeyGenerator,
    private readonly metrics: CacheMetricsService,
    private readonly matcher: SimilarityMatcher,
  ) {}

  async getEmbedding(text: string, organizationId: string): Promise<number[] | null> {
    const startTime = Date.now();
    const key = this.keyGenerator.generateKey('llm.embedding', organizationId, text);

    const cached = await this.provider.get<{ embedding: number[] }>(key, organizationId);
    if (cached) {
      this.metrics.recordHit('llm.embedding', Date.now() - startTime);
      return cached.value.embedding;
    }

    this.metrics.recordMiss('llm.embedding', Date.now() - startTime);
    return null;
  }

  async setEmbedding(text: string, embedding: number[], organizationId: string): Promise<void> {
    const startTime = Date.now();
    const key = this.keyGenerator.generateKey('llm.embedding', organizationId, text);

    await this.provider.set(key, { embedding }, organizationId, 'llm.embedding', {
      ttl: 600_000,
      tags: ['embedding'],
    });

    this.metrics.recordSave('llm.embedding', Date.now() - startTime);
  }

  async findSimilarEmbedding(
    embedding: number[],
    organizationId: string,
    minScore = 0.9,
  ): Promise<{ text: string; embedding: number[]; score: number } | null> {
    const startTime = Date.now();
    const results = await this.matcher.findSimilarByEmbedding(
      embedding,
      organizationId,
      'llm.embedding',
      { minScore, maxResults: 1 },
    );

    if (results.length > 0) {
      this.metrics.recordSemanticHit('llm.embedding', Date.now() - startTime);
      const value = results[0].value as { text: string; embedding: number[] };
      return { ...value, score: results[0].score };
    }

    return null;
  }

  async clear(organizationId?: string): Promise<number> {
    if (organizationId) {
      return this.provider.deleteByCategory('llm.embedding', organizationId);
    }
    await this.provider.clear();
    return 0;
  }
}
