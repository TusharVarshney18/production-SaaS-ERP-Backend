export interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
  totalVersions: number;
  indexedDocuments: number;
  pendingDocuments: number;
  failedDocuments: number;
  storageEstimateBytes: number;
}

export interface KnowledgeSummary {
  documentId: string;
  documentName: string;
  version: number;
  chunkCount: number;
  status: string;
}
