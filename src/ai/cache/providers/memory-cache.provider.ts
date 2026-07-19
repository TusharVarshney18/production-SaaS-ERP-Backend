import { Injectable, Logger } from '@nestjs/common';
import { ICacheProvider, CacheEntry, CacheOptions } from '../interfaces/cache-provider.interface';

@Injectable()
export class MemoryCacheProvider implements ICacheProvider {
  readonly name = 'memory';
  private readonly logger = new Logger(MemoryCacheProvider.name);
  private readonly store = new Map<string, CacheEntry>();
  private readonly orgIndex = new Map<string, Set<string>>();
  private readonly categoryIndex = new Map<string, Set<string>>();
  private readonly tagIndex = new Map<string, Set<string>>();

  async get<T>(key: string, organizationId: string): Promise<CacheEntry<T> | null> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (entry.metadata.organizationId !== organizationId) return null;
    if (this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    entry.metadata.accessedAt = Date.now();
    entry.metadata.accessCount++;
    return entry;
  }

  async set<T>(
    key: string,
    value: T,
    organizationId: string,
    category: string,
    options?: CacheOptions,
  ): Promise<void> {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      key,
      value,
      metadata: {
        createdAt: now,
        accessedAt: now,
        ttl: options?.ttl,
        slidingTtl: options?.slidingTtl,
        accessCount: 0,
        organizationId,
        category,
        tags: options?.tags || [],
        size: this.estimateSize(value),
      },
    };

    this.store.set(key, entry as CacheEntry);

    if (!this.orgIndex.has(organizationId)) this.orgIndex.set(organizationId, new Set());
    this.orgIndex.get(organizationId)!.add(key);

    if (!this.categoryIndex.has(category)) this.categoryIndex.set(category, new Set());
    this.categoryIndex.get(category)!.add(key);

    for (const tag of entry.metadata.tags) {
      if (!this.tagIndex.has(tag)) this.tagIndex.set(tag, new Set());
      this.tagIndex.get(tag)!.add(key);
    }
  }

  async delete(key: string, organizationId: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry || entry.metadata.organizationId !== organizationId) return false;
    this.removeFromIndexes(key, entry);
    return this.store.delete(key);
  }

  async deleteByCategory(category: string, organizationId: string): Promise<number> {
    const keys = this.categoryIndex.get(category);
    if (!keys) return 0;
    let count = 0;
    for (const key of keys) {
      const entry = this.store.get(key);
      if (entry && entry.metadata.organizationId === organizationId) {
        this.removeFromIndexes(key, entry);
        this.store.delete(key);
        count++;
      }
    }
    this.categoryIndex.delete(category);
    return count;
  }

  async deleteByOrganization(organizationId: string): Promise<number> {
    const keys = this.orgIndex.get(organizationId);
    if (!keys) return 0;
    const toDelete = [...keys];
    for (const key of toDelete) {
      const entry = this.store.get(key);
      if (entry) {
        this.removeFromIndexes(key, entry);
        this.store.delete(key);
      }
    }
    this.orgIndex.delete(organizationId);
    return toDelete.length;
  }

  async deleteByTags(tags: string[], organizationId: string): Promise<number> {
    const toDelete = new Set<string>();
    for (const tag of tags) {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        for (const key of keys) {
          const entry = this.store.get(key);
          if (entry && entry.metadata.organizationId === organizationId) {
            toDelete.add(key);
          }
        }
      }
    }
    for (const key of toDelete) {
      const entry = this.store.get(key);
      if (entry) {
        this.removeFromIndexes(key, entry);
        this.store.delete(key);
      }
    }
    return toDelete.size;
  }

  async exists(key: string, organizationId: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry || entry.metadata.organizationId !== organizationId) return false;
    return !this.isExpired(entry);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.orgIndex.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
  }

  async getSize(): Promise<number> {
    return this.store.size;
  }

  async getKeys(organizationId?: string): Promise<string[]> {
    if (!organizationId) return [...this.store.keys()];
    const keys = this.orgIndex.get(organizationId);
    return keys ? [...keys] : [];
  }

  getAllEntries(organizationId: string, category?: string): CacheEntry[] {
    const results: CacheEntry[] = [];
    for (const entry of this.store.values()) {
      if (entry.metadata.organizationId !== organizationId) continue;
      if (category && entry.metadata.category !== category) continue;
      if (this.isExpired(entry)) {
        this.store.delete(entry.key);
        continue;
      }
      results.push(entry);
    }
    return results;
  }

  private isExpired(entry: CacheEntry): boolean {
    const now = Date.now();
    if (entry.metadata.ttl && now - entry.metadata.createdAt > entry.metadata.ttl) return true;
    if (entry.metadata.slidingTtl && now - entry.metadata.accessedAt > entry.metadata.slidingTtl)
      return true;
    return false;
  }

  private removeFromIndexes(key: string, entry: CacheEntry): void {
    this.orgIndex.get(entry.metadata.organizationId)?.delete(key);
    this.categoryIndex.get(entry.metadata.category)?.delete(key);
    for (const tag of entry.metadata.tags) {
      this.tagIndex.get(tag)?.delete(key);
    }
  }

  private estimateSize(value: unknown): number {
    try {
      const str = typeof value === 'string' ? value : JSON.stringify(value);
      return Buffer.byteLength(str, 'utf-8');
    } catch {
      return 0;
    }
  }
}
