export type EvictionStrategy = 'lru' | 'lfu' | 'fifo' | 'ttl' | 'priority';

export interface CachePolicyConfig {
  maxSize: number;
  evictionStrategy: EvictionStrategy;
  defaultTtlMs: number;
  maxTtlMs: number;
  slidingWindowMs?: number;
  enablePriorityRetention: boolean;
}

export interface CachePolicy {
  category: string;
  config: CachePolicyConfig;
}

export interface ICachePolicyManager {
  getPolicy(category: string): CachePolicyConfig;
  setPolicy(category: string, config: Partial<CachePolicyConfig>): void;
  getDefaultPolicy(): CachePolicyConfig;
  shouldEvict(category: string, currentSize: number): boolean;
  selectEvictionCandidates(
    category: string,
    entries: Array<{
      key: string;
      metadata: { accessedAt: number; accessCount: number; createdAt: number };
    }>,
    count: number,
  ): string[];
}
