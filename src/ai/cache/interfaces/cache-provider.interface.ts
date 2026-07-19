export interface CacheEntryMetadata {
  createdAt: number;
  accessedAt: number;
  ttl?: number;
  slidingTtl?: number;
  accessCount: number;
  organizationId: string;
  category: string;
  tags: string[];
  size: number;
}

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  metadata: CacheEntryMetadata;
}

export interface CacheOptions {
  ttl?: number;
  slidingTtl?: number;
  tags?: string[];
  priority?: 'low' | 'normal' | 'high';
}

export interface ICacheProvider {
  readonly name: string;
  get<T>(key: string, organizationId: string): Promise<CacheEntry<T> | null>;
  set<T>(
    key: string,
    value: T,
    organizationId: string,
    category: string,
    options?: CacheOptions,
  ): Promise<void>;
  delete(key: string, organizationId: string): Promise<boolean>;
  deleteByCategory(category: string, organizationId: string): Promise<number>;
  deleteByOrganization(organizationId: string): Promise<number>;
  deleteByTags(tags: string[], organizationId: string): Promise<number>;
  exists(key: string, organizationId: string): Promise<boolean>;
  clear(): Promise<void>;
  getSize(): Promise<number>;
  getKeys(organizationId?: string): Promise<string[]>;
}
