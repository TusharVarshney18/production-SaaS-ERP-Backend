import { Injectable, Logger } from '@nestjs/common';
import {
  ISimilarityMatcher,
  SimilarityResult,
  MatchOptions,
} from '../interfaces/similarity.interface';
import { MemoryCacheProvider } from '../providers/memory-cache.provider';

@Injectable()
export class SimilarityMatcher implements ISimilarityMatcher {
  private readonly logger = new Logger(SimilarityMatcher.name);

  constructor(private readonly provider: MemoryCacheProvider) {}

  async findSimilar(
    input: string,
    organizationId: string,
    category: string,
    options?: Partial<MatchOptions>,
  ): Promise<SimilarityResult[]> {
    const opts: MatchOptions = {
      minScore: options?.minScore ?? 0.85,
      maxResults: options?.maxResults ?? 5,
      useSemanticFallback: options?.useSemanticFallback ?? false,
    };

    const entries = this.provider.getAllEntries(organizationId, category);
    const results: SimilarityResult[] = [];

    for (const entry of entries) {
      const inputStr = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
      const score = this.computeSimilarity(input, inputStr);
      if (score >= opts.minScore) {
        results.push({
          key: entry.key,
          value: entry.value,
          score,
          metadata: { category: entry.metadata.category, tags: entry.metadata.tags },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.maxResults);
  }

  async findSimilarByEmbedding(
    embedding: number[],
    organizationId: string,
    category: string,
    options?: Partial<MatchOptions>,
  ): Promise<SimilarityResult[]> {
    const opts: MatchOptions = {
      minScore: options?.minScore ?? 0.9,
      maxResults: options?.maxResults ?? 5,
      useSemanticFallback: options?.useSemanticFallback ?? false,
    };

    const entries = this.provider.getAllEntries(organizationId, category);
    const results: SimilarityResult[] = [];

    for (const entry of entries) {
      const entryEmbedding = (entry.value as any)?.embedding as number[] | undefined;
      if (!entryEmbedding) continue;
      const score = this.cosineSimilarity(embedding, entryEmbedding);
      if (score >= opts.minScore) {
        results.push({
          key: entry.key,
          value: entry.value,
          score,
          metadata: { category: entry.metadata.category, tags: entry.metadata.tags },
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, opts.maxResults);
  }

  computeSimilarity(a: string, b: string): number {
    if (a === b) return 1.0;
    if (!a || !b) return 0;
    const normalizedA = a.toLowerCase().trim();
    const normalizedB = b.toLowerCase().trim();
    if (normalizedA === normalizedB) return 1.0;
    if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
      const shorter = normalizedA.length < normalizedB.length ? normalizedA : normalizedB;
      const longer = normalizedA.length < normalizedB.length ? normalizedB : normalizedA;
      return shorter.length / longer.length;
    }
    const wordsA = new Set(normalizedA.split(/\s+/));
    const wordsB = new Set(normalizedB.split(/\s+/));
    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}
