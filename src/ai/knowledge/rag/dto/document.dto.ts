export type DocumentSource =
  'upload' | 'website' | 'sharepoint' | 'google_drive' | 'notion' | 'confluence';
export type DocumentStatus = 'pending' | 'processing' | 'indexed' | 'failed';

export interface KnowledgeDocument {
  id: string;
  organizationId: string;
  uploadedBy: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  source: DocumentSource;
  status: DocumentStatus;
  metadata: Record<string, unknown>;
  version: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentUploadInput {
  fileName: string;
  fileSize: number;
  mimeType: string;
  buffer: Buffer;
  metadata?: Record<string, unknown>;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  organizationId: string;
  version: number;
  fileHash: string;
  chunkCount: number;
  status: DocumentStatus;
  error?: string;
  createdAt: string;
}
