export enum CacheErrorCode {
  CACHE_FULL = 'CACHE_FULL',
  KEY_NOT_FOUND = 'KEY_NOT_FOUND',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  INVALID_KEY = 'INVALID_KEY',
  ORGANIZATION_MISMATCH = 'ORGANIZATION_MISMATCH',
}

export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: CacheErrorCode = CacheErrorCode.PROVIDER_ERROR,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CacheError';
  }
}
