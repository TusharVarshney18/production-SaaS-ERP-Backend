export interface DocumentChunk {
  id: string;
  documentId: string;
  organizationId: string;
  version: number;
  content: string;
  metadata: Record<string, unknown>;
  tokenEstimate: number;
  embedding?: number[];
  index: number;
  createdAt: string;
}
