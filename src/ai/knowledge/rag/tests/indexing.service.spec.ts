import { IndexingService } from '../indexing/indexing.service';
import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { MockEmbeddingProvider } from '../embeddings/mock-embedding.provider';
import { DocumentRepository } from '../repositories/document.repository';

describe('IndexingService', () => {
  let indexingService: IndexingService;
  let vectorStore: InMemoryVectorStore;

  beforeEach(() => {
    vectorStore = new InMemoryVectorStore();
    const docRepo = new DocumentRepository();
    const factory = new EmbeddingProviderFactory(new MockEmbeddingProvider());
    indexingService = new IndexingService(vectorStore, factory, docRepo);
  });

  it('should index chunks and store vectors', async () => {
    const count = await indexingService.indexChunks([
      {
        chunk: {
          id: 'c1',
          documentId: 'd1',
          organizationId: 'org1',
          version: 1,
          content: 'test content',
          metadata: {},
          tokenEstimate: 5,
          index: 0,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    expect(count).toBe(1);

    const results = await vectorStore.search(
      await indexingService['embeddingProvider'].generateEmbedding('test'),
      { organizationId: 'org1' },
    );
    expect(results.length).toBeGreaterThan(0);
  });

  it('should delete document index', async () => {
    await indexingService.indexChunks([
      {
        chunk: {
          id: 'c1',
          documentId: 'd1',
          organizationId: 'org1',
          version: 1,
          content: 'test',
          metadata: {},
          tokenEstimate: 1,
          index: 0,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    const deleted = await indexingService.deleteDocumentIndex('d1', 'org1');
    expect(deleted).toBeGreaterThan(0);

    const results = await vectorStore.search(Array(384).fill(0), { organizationId: 'org1' });
    expect(results).toHaveLength(0);
  });

  it('should clear embedding cache', () => {
    indexingService.clearCache();
  });

  it('should use embedding cache', async () => {
    await indexingService.indexChunks([
      {
        chunk: {
          id: 'c1',
          documentId: 'd1',
          organizationId: 'org1',
          version: 1,
          content: 'cached content',
          metadata: {},
          tokenEstimate: 3,
          index: 0,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    await indexingService.indexChunks([
      {
        chunk: {
          id: 'c2',
          documentId: 'd1',
          organizationId: 'org1',
          version: 1,
          content: 'cached content',
          metadata: {},
          tokenEstimate: 3,
          index: 1,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    const results = await vectorStore.search(Array(384).fill(0), { organizationId: 'org1' });
    expect(results).toHaveLength(2);
  });
});
