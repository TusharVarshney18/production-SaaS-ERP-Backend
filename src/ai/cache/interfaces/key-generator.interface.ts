export interface CacheKeyParts {
  category: string;
  organizationId: string;
  hash: string;
  parts?: string[];
}

export interface ICacheKeyGenerator {
  generateKey(category: string, organizationId: string, ...parts: string[]): string;
  generateHash(input: string): string;
  parseKey(key: string): CacheKeyParts | null;
}
