export interface KnowledgeStats {
  totalDocuments: number;
  totalChunks: number;
  totalVersions: number;
  indexedDocuments: number;
  pendingDocuments: number;
  failedDocuments: number;
  storageEstimateBytes: number;
}
