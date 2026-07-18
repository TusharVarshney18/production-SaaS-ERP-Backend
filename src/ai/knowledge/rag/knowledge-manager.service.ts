import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  DocumentProcessorService,
  ProcessedDocument,
} from './documents/document-processor.service';
import { ChunkService } from './chunking/chunk.service';
import { IndexingService } from './indexing/indexing.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { DocumentRepository } from './repositories/document.repository';
import {
  KnowledgeDocument,
  DocumentUploadInput,
  DocumentVersion,
  DocumentStatus,
} from './dto/document.dto';
import { DocumentChunk } from './dto/chunk.dto';
import { KnowledgeStats } from './dto/knowledge.dto';

function simpleHash(buffer: Buffer): string {
  let hash = 0;
  const str = buffer.toString('utf-8').substring(0, 10000);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

@Injectable()
export class KnowledgeManagerService {
  private readonly logger = new Logger(KnowledgeManagerService.name);

  constructor(
    private readonly documentProcessor: DocumentProcessorService,
    private readonly chunkService: ChunkService,
    private readonly indexingService: IndexingService,
    private readonly knowledgeRepository: KnowledgeRepository,
    private readonly documentRepository: DocumentRepository,
  ) {}

  async ingestDocument(
    input: DocumentUploadInput,
    organizationId: string,
    uploadedBy: string,
    options?: { chunkStrategy?: string; metadata?: Record<string, unknown> },
  ): Promise<KnowledgeDocument> {
    this.logger.log(`Ingesting document: ${input.fileName} for org ${organizationId}`);

    const document = await this.createDocumentRecord(input, organizationId, uploadedBy);

    try {
      await this.updateDocumentStatus(document.id, 'processing');

      const processed = await this.documentProcessor.process(
        input.buffer,
        input.mimeType,
        input.fileName,
        { ...options?.metadata, source: 'upload', uploadedBy },
      );

      const chunks = await this.generateChunks(document, processed, options?.chunkStrategy);

      const fileHash = simpleHash(input.buffer);

      const version = await this.createVersion(
        document.id,
        organizationId,
        fileHash,
        chunks.length,
      );

      await this.indexingService.indexChunks(chunks.map((chunk) => ({ chunk })));

      await this.knowledgeRepository.updateDocument(document.id, {
        status: 'indexed',
        version: version.version,
      });

      this.logger.log(`Document ${document.id} indexed successfully with ${chunks.length} chunks`);

      const updated = await this.knowledgeRepository.getDocument(document.id);
      return updated ?? document;
    } catch (error) {
      this.logger.error(`Failed to ingest document ${document.id}: ${error.message}`, error.stack);
      await this.updateDocumentStatus(document.id, 'failed', error.message);
      throw error;
    }
  }

  async deleteDocument(documentId: string, organizationId: string): Promise<boolean> {
    this.logger.log(`Deleting document ${documentId} from org ${organizationId}`);

    await this.indexingService.deleteDocumentIndex(documentId, organizationId);
    return this.knowledgeRepository.deleteDocument(documentId);
  }

  async getDocument(documentId: string): Promise<KnowledgeDocument | null> {
    return this.knowledgeRepository.getDocument(documentId);
  }

  async listDocuments(
    organizationId: string,
    limit = 50,
    offset = 0,
  ): Promise<KnowledgeDocument[]> {
    return this.knowledgeRepository.listDocuments(organizationId, limit, offset);
  }

  async getDocumentChunks(documentId: string): Promise<DocumentChunk[]> {
    return this.documentRepository.getChunksByDocumentId(documentId);
  }

  async getStats(organizationId: string): Promise<KnowledgeStats> {
    const totalDocuments = await this.knowledgeRepository.countDocuments(organizationId);
    const indexedDocuments = await this.knowledgeRepository.countDocuments(
      organizationId,
      'indexed',
    );
    const pendingDocuments = await this.knowledgeRepository.countDocuments(
      organizationId,
      'pending',
    );
    const failedDocuments = await this.knowledgeRepository.countDocuments(organizationId, 'failed');
    const totalChunks = await this.documentRepository.countChunks(organizationId);

    const docs = await this.knowledgeRepository.listDocuments(organizationId, 1000);
    const totalVersions = docs.reduce((sum) => sum + 1, 0);
    const storageEstimateBytes = docs.reduce((sum, d) => sum + d.fileSize, 0);

    return {
      totalDocuments,
      totalChunks,
      totalVersions,
      indexedDocuments,
      pendingDocuments,
      failedDocuments,
      storageEstimateBytes,
    };
  }

  private async createDocumentRecord(
    input: DocumentUploadInput,
    organizationId: string,
    uploadedBy: string,
  ): Promise<KnowledgeDocument> {
    const document: KnowledgeDocument = {
      id: randomUUID(),
      organizationId,
      uploadedBy,
      fileName: input.fileName,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      source: 'upload',
      status: 'pending',
      metadata: input.metadata || {},
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.knowledgeRepository.createDocument(document);
  }

  private async generateChunks(
    document: KnowledgeDocument,
    processed: ProcessedDocument,
    strategyName?: string,
  ): Promise<DocumentChunk[]> {
    const chunkResults = await this.chunkService.chunk(processed.cleanedText, strategyName, {
      documentId: document.id,
      organizationId: document.organizationId,
      fileName: document.fileName,
      mimeType: document.mimeType,
      ...processed.metadata,
    });

    return chunkResults.map((cr, idx) => ({
      id: randomUUID(),
      documentId: document.id,
      organizationId: document.organizationId,
      version: 1,
      content: cr.content,
      metadata: cr.metadata,
      tokenEstimate: cr.tokenEstimate,
      index: idx,
      createdAt: new Date().toISOString(),
    }));
  }

  private async createVersion(
    documentId: string,
    organizationId: string,
    fileHash: string,
    chunkCount: number,
  ): Promise<DocumentVersion> {
    const existingVersions = await this.knowledgeRepository.getVersions(documentId);
    const versionNumber = existingVersions.length + 1;

    const version: DocumentVersion = {
      id: randomUUID(),
      documentId,
      organizationId,
      version: versionNumber,
      fileHash,
      chunkCount,
      status: 'indexed',
      createdAt: new Date().toISOString(),
    };

    return this.knowledgeRepository.addVersion(version);
  }

  private async updateDocumentStatus(
    documentId: string,
    status: DocumentStatus,
    error?: string,
  ): Promise<void> {
    const updates: Partial<KnowledgeDocument> = { status };
    if (error) updates.error = error;
    await this.knowledgeRepository.updateDocument(documentId, updates);
  }
}
