import { Injectable } from '@nestjs/common';
import {
  IVectorStore,
  VectorRecord,
  VectorSearchResult,
  VectorSearchOptions,
} from '../interfaces/vector-store.interface';

@Injectable()
export class InMemoryVectorStore implements IVectorStore {
  private readonly records = new Map<string, VectorRecord>();

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      this.records.set(record.id, record);
    }
  }

  async search(query: number[], options: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const candidates = [...this.records.values()].filter((r) => {
      if (r.organizationId !== options.organizationId) return false;
      if (options.documentIds && !options.documentIds.includes(r.documentId)) return false;
      if (options.metadataFilter) {
        for (const [key, value] of Object.entries(options.metadataFilter)) {
          if (r.metadata[key] !== value) return false;
        }
      }
      return true;
    });

    const results: VectorSearchResult[] = [];
    for (const record of candidates) {
      const score = this.cosineSimilarity(query, record.embedding);
      if (options.scoreThreshold !== undefined && score < options.scoreThreshold) continue;
      results.push({ record, score });
    }

    results.sort((a, b) => b.score - a.score);

    const limit = options.limit || 10;
    return results.slice(0, limit);
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) {
      this.records.delete(id);
    }
  }

  async deleteByDocumentId(documentId: string, organizationId: string): Promise<number> {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.documentId === documentId && record.organizationId === organizationId) {
        this.records.delete(id);
        count++;
      }
    }
    return count;
  }

  async deleteByOrganizationId(organizationId: string): Promise<number> {
    let count = 0;
    for (const [id, record] of this.records.entries()) {
      if (record.organizationId === organizationId) {
        this.records.delete(id);
        count++;
      }
    }
    return count;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }
}
