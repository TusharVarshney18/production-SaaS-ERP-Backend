export const TOKEN_ESTIMATE_DIVISOR = 4;

export function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / TOKEN_ESTIMATE_DIVISOR);
}

export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
}

export const DEFAULT_CONTEXT_LIMIT = 8192;

export const DEFAULT_MAX_MESSAGES = 50;

export const DEFAULT_LIST_LIMIT = 50;
export const DEFAULT_LIST_OFFSET = 0;

export const CACHE_TTL_MS = 300_000;

export const SANDBOX_DEFAULT_TIMEOUT_MS = 30_000;
export const SANDBOX_MAX_INPUT_SIZE = 1_048_576;

export const PROVIDER_DEFAULT_TIMEOUT_MS = 5_000;
export const PROVIDER_OLLAMA_TIMEOUT_MS = 3_000;
export const PROVIDER_AZURE_TIMEOUT_MS = 10_000;

export const API_KEY_MIN_LENGTH = 8;

export const EMBEDDING_DEFAULT_DIMENSIONS = 384;

export const RAG_DEFAULT_CHUNK_SIZE = 512;
export const RAG_DEFAULT_OVERLAP = 64;
export const RAG_DEFAULT_MIN_CHUNK_SIZE = 128;
export const RAG_DEFAULT_MAX_CHUNK_SIZE = 1024;
export const RAG_MAX_FILE_SIZE = 50 * 1024 * 1024;
export const RAG_DEFAULT_TOP_K = 10;
export const RAG_PAGE_ESTIMATE_CHARS = 3_000;
export const RAG_SOURCE_PRIORITY_DEFAULT = 'upload';
export const RAG_DEFAULT_DOCUMENT_NAME = 'Unknown';
