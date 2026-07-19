export interface CategoryMetrics {
  hits: number;
  misses: number;
  semanticHits: number;
  totalLookups: number;
  averageLookupTime: number;
  averageSaveTime: number;
  size: number;
  evictions: number;
  hitRate: number;
}

export interface CacheMetrics {
  totalHits: number;
  totalMisses: number;
  totalSemanticHits: number;
  totalLookups: number;
  overallHitRate: number;
  overallSemanticHitRate: number;
  totalSize: number;
  totalEvictions: number;
  categories: Record<string, CategoryMetrics>;
}

export interface ICacheMetricsService {
  recordHit(category: string, duration: number): void;
  recordMiss(category: string, duration: number): void;
  recordSemanticHit(category: string, duration: number): void;
  recordSave(category: string, duration: number): void;
  recordEviction(category: string): void;
  getMetrics(): Promise<CacheMetrics>;
  getCategoryMetrics(category: string): CategoryMetrics | undefined;
  reset(): void;
}
