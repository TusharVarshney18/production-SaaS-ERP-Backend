import { Injectable } from '@nestjs/common';
import {
  ICacheMetricsService,
  CacheMetrics,
  CategoryMetrics,
} from '../interfaces/metrics.interface';
import { CACHE_CATEGORIES } from '../dto/cache-category.dto';

interface CategoryStats {
  hits: number;
  misses: number;
  semanticHits: number;
  lookups: number;
  totalLookupTime: number;
  totalSaveTime: number;
  size: number;
  evictions: number;
}

@Injectable()
export class CacheMetricsService implements ICacheMetricsService {
  private readonly stats = new Map<string, CategoryStats>();
  private readonly windowSize = 60_000;
  private startTime = Date.now();

  constructor() {
    for (const cat of CACHE_CATEGORIES) {
      this.stats.set(cat, this.emptyStats());
    }
  }

  recordHit(category: string, duration: number): void {
    this.getStats(category).hits++;
    this.getStats(category).lookups++;
    this.getStats(category).totalLookupTime += duration;
  }

  recordMiss(category: string, duration: number): void {
    this.getStats(category).misses++;
    this.getStats(category).lookups++;
    this.getStats(category).totalLookupTime += duration;
  }

  recordSemanticHit(category: string, duration: number): void {
    this.getStats(category).semanticHits++;
    this.getStats(category).hits++;
    this.getStats(category).lookups++;
    this.getStats(category).totalLookupTime += duration;
  }

  recordSave(category: string, duration: number): void {
    this.getStats(category).totalSaveTime += duration;
  }

  recordEviction(category: string): void {
    this.getStats(category).evictions++;
  }

  async getMetrics(): Promise<CacheMetrics> {
    let totalHits = 0;
    let totalMisses = 0;
    let totalSemanticHits = 0;
    let totalLookups = 0;
    let totalSize = 0;
    let totalEvictions = 0;
    const categories: Record<string, CategoryMetrics> = {};

    for (const [cat, stats] of this.stats) {
      const hitRate = stats.lookups > 0 ? stats.hits / stats.lookups : 0;
      const catMetrics: CategoryMetrics = {
        hits: stats.hits,
        misses: stats.misses,
        semanticHits: stats.semanticHits,
        totalLookups: stats.lookups,
        averageLookupTime: stats.lookups > 0 ? stats.totalLookupTime / stats.lookups : 0,
        averageSaveTime: 0,
        size: stats.size,
        evictions: stats.evictions,
        hitRate,
      };
      categories[cat] = catMetrics;

      totalHits += stats.hits;
      totalMisses += stats.misses;
      totalSemanticHits += stats.semanticHits;
      totalLookups += stats.lookups;
      totalSize += stats.size;
      totalEvictions += stats.evictions;
    }

    return {
      totalHits,
      totalMisses,
      totalSemanticHits,
      totalLookups,
      overallHitRate: totalLookups > 0 ? totalHits / totalLookups : 0,
      overallSemanticHitRate: totalLookups > 0 ? totalSemanticHits / totalLookups : 0,
      totalSize,
      totalEvictions,
      categories,
    };
  }

  getCategoryMetrics(category: string): CategoryMetrics | undefined {
    const stats = this.stats.get(category);
    if (!stats) return undefined;
    return {
      hits: stats.hits,
      misses: stats.misses,
      semanticHits: stats.semanticHits,
      totalLookups: stats.lookups,
      averageLookupTime: stats.lookups > 0 ? stats.totalLookupTime / stats.lookups : 0,
      averageSaveTime: 0,
      size: stats.size,
      evictions: stats.evictions,
      hitRate: stats.lookups > 0 ? stats.hits / stats.lookups : 0,
    };
  }

  reset(): void {
    this.stats.clear();
    for (const cat of CACHE_CATEGORIES) {
      this.stats.set(cat, this.emptyStats());
    }
    this.startTime = Date.now();
  }

  private emptyStats(): CategoryStats {
    return {
      hits: 0,
      misses: 0,
      semanticHits: 0,
      lookups: 0,
      totalLookupTime: 0,
      totalSaveTime: 0,
      size: 0,
      evictions: 0,
    };
  }

  private getStats(category: string): CategoryStats {
    if (!this.stats.has(category)) {
      this.stats.set(category, this.emptyStats());
    }
    return this.stats.get(category)!;
  }
}
