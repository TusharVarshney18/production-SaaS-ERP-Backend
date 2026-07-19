import { Injectable } from '@nestjs/common';
import { IKnowledgeRepository } from '../interfaces/repository.interface';
import { KnowledgeDocument, DocumentVersion, DocumentStatus } from '../dto/document.dto';

@Injectable()
export class KnowledgeRepository implements IKnowledgeRepository {
  private readonly documents = new Map<string, KnowledgeDocument>();
  private readonly versions = new Map<string, DocumentVersion[]>();

  async createDocument(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    this.documents.set(doc.id, { ...doc });
    return doc;
  }

  async getDocument(id: string): Promise<KnowledgeDocument | null> {
    return this.documents.get(id) || null;
  }

  async updateDocument(
    id: string,
    updates: Partial<KnowledgeDocument>,
  ): Promise<KnowledgeDocument | null> {
    const existing = this.documents.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.documents.set(id, updated);
    return updated;
  }

  async deleteDocument(id: string): Promise<boolean> {
    this.versions.delete(id);
    return this.documents.delete(id);
  }

  async listDocuments(
    organizationId: string,
    limit = 50,
    offset = 0,
  ): Promise<KnowledgeDocument[]> {
    return [...this.documents.values()]
      .filter((d) => d.organizationId === organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(offset, offset + limit);
  }

  async countDocuments(organizationId: string, status?: DocumentStatus): Promise<number> {
    return [...this.documents.values()].filter(
      (d) => d.organizationId === organizationId && (!status || d.status === status),
    ).length;
  }

  async addVersion(version: DocumentVersion): Promise<DocumentVersion> {
    const existing = this.versions.get(version.documentId) || [];
    existing.push(version);
    this.versions.set(version.documentId, existing);
    return version;
  }

  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.versions.get(documentId) || [];
  }

  async getLatestVersion(documentId: string): Promise<DocumentVersion | null> {
    const versions = this.versions.get(documentId);
    if (!versions || versions.length === 0) return null;
    return versions.sort((a, b) => b.version - a.version)[0];
  }
}
