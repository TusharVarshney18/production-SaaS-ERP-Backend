import { DocumentChunk } from './chunk.dto';

export interface RetrievalQuery {
  query: string;
  organizationId: string;
  topK?: number;
  scoreThreshold?: number;
  metadataFilter?: Record<string, unknown>;
  documentIds?: string[];
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number;
  rank: number;
}

export interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface RagResponse {
  query: string;
  results: RetrievalResult[];
  citations: Citation[];
  totalResults: number;
  processingTimeMs: number;
}
