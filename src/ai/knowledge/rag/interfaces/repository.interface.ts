import { KnowledgeDocument, DocumentVersion, DocumentStatus } from '../dto/document.dto';
import { DocumentChunk } from '../dto/chunk.dto';

export interface IKnowledgeRepository {
  createDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument>;
  getDocument(id: string): Promise<KnowledgeDocument | null>;
  updateDocument(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument | null>;
  deleteDocument(id: string): Promise<boolean>;
  listDocuments(organizationId: string, limit?: number, offset?: number): Promise<KnowledgeDocument[]>;
  countDocuments(organizationId: string, status?: DocumentStatus): Promise<number>;
  addVersion(version: DocumentVersion): Promise<DocumentVersion>;
  getVersions(documentId: string): Promise<DocumentVersion[]>;
  getLatestVersion(documentId: string): Promise<DocumentVersion | null>;
}

export interface IDocumentRepository {
  saveChunks(chunks: DocumentChunk[]): Promise<DocumentChunk[]>;
  getChunk(id: string): Promise<DocumentChunk | null>;
  getChunksByDocumentId(documentId: string): Promise<DocumentChunk[]>;
  getChunksByOrganizationId(organizationId: string): Promise<DocumentChunk[]>;
  deleteChunksByDocumentId(documentId: string, organizationId: string): Promise<number>;
  deleteChunk(id: string): Promise<boolean>;
  countChunks(organizationId?: string): Promise<number>;
}
