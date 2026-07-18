export interface VectorRecord {
  id: string;
  organizationId: string;
  chunkId: string;
  documentId: string;
  documentVersion: number;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface VectorSearchResult {
  record: VectorRecord;
  score: number;
}

export interface VectorSearchOptions {
  organizationId: string;
  limit?: number;
  scoreThreshold?: number;
  metadataFilter?: Record<string, unknown>;
  documentIds?: string[];
}

export interface IVectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
  search(query: number[], options: VectorSearchOptions): Promise<VectorSearchResult[]>;
  delete(ids: string[]): Promise<void>;
  deleteByDocumentId(documentId: string, organizationId: string): Promise<number>;
  deleteByOrganizationId(organizationId: string): Promise<number>;
}
