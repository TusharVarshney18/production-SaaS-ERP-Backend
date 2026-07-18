import { HybridRetrievalService } from '../retrieval/hybrid-retrieval.service';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { MockEmbeddingProvider } from '../embeddings/mock-embedding.provider';
import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { DocumentRepository } from '../repositories/document.repository';
import { RankerService } from '../retrieval/ranker.service';
import { VectorRecord } from '../interfaces/vector-store.interface';

describe('HybridRetrievalService', () => {
  let service: HybridRetrievalService;
  let vectorStore: InMemoryVectorStore;
  let docRepo: DocumentRepository;

  beforeEach(async () => {
    vectorStore = new InMemoryVectorStore();
    docRepo = new DocumentRepository();
    const mockProvider = new MockEmbeddingProvider();
    const factory = new EmbeddingProviderFactory(mockProvider);
    const ranker = new RankerService();

    service = new HybridRetrievalService(vectorStore, factory, docRepo, ranker);
  });

  it('should return results for a query', async () => {
    const text = 'The capital of France is Paris';
    const embedding = await service['embeddingProvider'].generateEmbedding(text);

    await vectorStore.upsert([
      {
        id: 'v1',
        organizationId: 'org1',
        chunkId: 'c1',
        documentId: 'd1',
        documentVersion: 1,
        embedding,
        metadata: { content: text },
      },
    ]);

    await docRepo.saveChunks([
      {
        id: 'c1',
        documentId: 'd1',
        organizationId: 'org1',
        version: 1,
        content: text,
        metadata: {},
        tokenEstimate: 10,
        index: 0,
        createdAt: new Date().toISOString(),
      },
    ]);

    const results = await service.retrieve({
      query: 'France capital',
      organizationId: 'org1',
      topK: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.content).toContain('France');
  });

  it('should enforce organization isolation', async () => {
    const embedding = await service['embeddingProvider'].generateEmbedding('test');
    await vectorStore.upsert([
      {
        id: 'v1',
        organizationId: 'org1',
        chunkId: 'c1',
        documentId: 'd1',
        documentVersion: 1,
        embedding,
        metadata: {},
      },
    ]);

    const results = await service.retrieve({
      query: 'test',
      organizationId: 'org2',
    });

    expect(results).toHaveLength(0);
  });

  it('should respect topK parameter', async () => {
    const embedding = await service['embeddingProvider'].generateEmbedding('test');
    const records: VectorRecord[] = [];
    const chunks: any[] = [];

    for (let i = 0; i < 5; i++) {
      records.push({
        id: `v${i}`,
        organizationId: 'org1',
        chunkId: `c${i}`,
        documentId: 'd1',
        documentVersion: 1,
        embedding,
        metadata: {},
      });
      chunks.push({
        id: `c${i}`,
        documentId: 'd1',
        organizationId: 'org1',
        version: 1,
        content: `chunk ${i}`,
        metadata: {},
        tokenEstimate: 1,
        index: i,
        createdAt: new Date().toISOString(),
      });
    }

    await vectorStore.upsert(records);
    await docRepo.saveChunks(chunks);

    const results = await service.retrieve({
      query: 'test',
      organizationId: 'org1',
      topK: 2,
    });

    expect(results.length).toBeLessThanOrEqual(2);
  });
});
