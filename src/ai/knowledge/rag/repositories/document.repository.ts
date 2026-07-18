import { Injectable } from '@nestjs/common';
import { DocumentChunk } from '../dto/chunk.dto';

@Injectable()
export class DocumentRepository {
  private readonly chunks = new Map<string, DocumentChunk>();

  async saveChunks(chunks: DocumentChunk[]): Promise<DocumentChunk[]> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, { ...chunk });
    }
    return chunks;
  }

  async getChunk(id: string): Promise<DocumentChunk | null> {
    return this.chunks.get(id) || null;
  }

  async getChunksByDocumentId(documentId: string): Promise<DocumentChunk[]> {
    return [...this.chunks.values()].filter((c) => c.documentId === documentId);
  }

  async getChunksByOrganizationId(organizationId: string): Promise<DocumentChunk[]> {
    return [...this.chunks.values()].filter((c) => c.organizationId === organizationId);
  }

  async deleteChunksByDocumentId(documentId: string, organizationId: string): Promise<number> {
    let count = 0;
    for (const [id, chunk] of this.chunks.entries()) {
      if (chunk.documentId === documentId && chunk.organizationId === organizationId) {
        this.chunks.delete(id);
        count++;
      }
    }
    return count;
  }

  async deleteChunk(id: string): Promise<boolean> {
    return this.chunks.delete(id);
  }

  async countChunks(organizationId?: string): Promise<number> {
    if (!organizationId) return this.chunks.size;
    return [...this.chunks.values()].filter((c) => c.organizationId === organizationId).length;
  }
}
