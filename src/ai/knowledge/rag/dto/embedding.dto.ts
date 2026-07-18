export interface EmbeddingRequest {
  texts: string[];
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

export interface EmbeddingCacheEntry {
  text: string;
  embedding: number[];
  createdAt: number;
}
