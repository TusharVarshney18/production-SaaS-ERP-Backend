import { Injectable, Logger } from '@nestjs/common';
import { ICachePolicyManager, CachePolicyConfig } from '../interfaces/policy.interface';

@Injectable()
export class CachePolicyManager implements ICachePolicyManager {
  private readonly logger = new Logger(CachePolicyManager.name);
  private readonly policies = new Map<string, CachePolicyConfig>();

  constructor() {
    this.initDefaults();
  }

  getPolicy(category: string): CachePolicyConfig {
    return this.policies.get(category) || this.getDefaultPolicy();
  }

  setPolicy(category: string, config: Partial<CachePolicyConfig>): void {
    const existing = this.getPolicy(category);
    this.policies.set(category, { ...existing, ...config });
    this.logger.log(
      `Cache policy updated for ${category}: eviction=${config.evictionStrategy || existing.evictionStrategy}, maxSize=${config.maxSize || existing.maxSize}`,
    );
  }

  getDefaultPolicy(): CachePolicyConfig {
    return {
      maxSize: 1000,
      evictionStrategy: 'lru',
      defaultTtlMs: 300_000,
      maxTtlMs: 3_600_000,
      enablePriorityRetention: false,
    };
  }

  shouldEvict(category: string, currentSize: number): boolean {
    const policy = this.getPolicy(category);
    return currentSize >= policy.maxSize;
  }

  selectEvictionCandidates(
    category: string,
    entries: Array<{
      key: string;
      metadata: { accessedAt: number; accessCount: number; createdAt: number };
    }>,
    count: number,
  ): string[] {
    const policy = this.getPolicy(category);
    const sorted = [...entries];

    switch (policy.evictionStrategy) {
      case 'lru':
        sorted.sort((a, b) => a.metadata.accessedAt - b.metadata.accessedAt);
        break;
      case 'lfu':
        sorted.sort((a, b) => a.metadata.accessCount - b.metadata.accessCount);
        break;
      case 'fifo':
        sorted.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
        break;
      case 'ttl': {
        const now = Date.now();
        sorted.sort((a, b) => {
          const ageA = now - a.metadata.createdAt;
          const ageB = now - b.metadata.createdAt;
          return ageB - ageA;
        });
        break;
      }
      case 'priority':
        sorted.sort((a, b) => a.metadata.accessCount - b.metadata.accessCount);
        break;
    }

    return sorted.slice(0, count).map((e) => e.key);
  }

  private initDefaults(): void {
    const defaults: Record<string, Partial<CachePolicyConfig>> = {
      'llm.response': { maxSize: 500, defaultTtlMs: 300_000, evictionStrategy: 'lru' },
      'llm.embedding': { maxSize: 2000, defaultTtlMs: 600_000, evictionStrategy: 'lru' },
      'rag.retrieval': { maxSize: 1000, defaultTtlMs: 300_000, evictionStrategy: 'lru' },
      'rag.knowledge': { maxSize: 500, defaultTtlMs: 600_000, evictionStrategy: 'lru' },
      'agent.output': { maxSize: 300, defaultTtlMs: 300_000, evictionStrategy: 'lru' },
      'workflow.result': { maxSize: 200, defaultTtlMs: 600_000, evictionStrategy: 'lru' },
      'mcp.tool': { maxSize: 300, defaultTtlMs: 120_000, evictionStrategy: 'lru' },
      'document.parse': { maxSize: 100, defaultTtlMs: 3_600_000, evictionStrategy: 'lru' },
      'prompt.result': { maxSize: 200, defaultTtlMs: 300_000, evictionStrategy: 'lru' },
      'conversation.summary': { maxSize: 100, defaultTtlMs: 600_000, evictionStrategy: 'lru' },
    };

    for (const [category, config] of Object.entries(defaults)) {
      this.policies.set(category, { ...this.getDefaultPolicy(), ...config });
    }
  }
}
