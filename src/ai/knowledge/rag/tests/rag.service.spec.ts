import { RagService } from '../rag/rag.service';
import { HybridRetrievalService } from '../retrieval/hybrid-retrieval.service';
import { RankerService } from '../retrieval/ranker.service';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { MockEmbeddingProvider } from '../embeddings/mock-embedding.provider';
import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { DocumentRepository } from '../repositories/document.repository';

describe('RagService', () => {
  let ragService: RagService;
  let vectorStore: InMemoryVectorStore;
  let docRepo: DocumentRepository;
  let knowledgeRepo: KnowledgeRepository;

  beforeEach(async () => {
    vectorStore = new InMemoryVectorStore();
    docRepo = new DocumentRepository();
    knowledgeRepo = new KnowledgeRepository();
    const mockProvider = new MockEmbeddingProvider();
    const factory = new EmbeddingProviderFactory();
    factory.registerProvider(mockProvider, true);
    const ranker = new RankerService();
    const retrieval = new HybridRetrievalService(vectorStore, factory, docRepo, ranker);

    ragService = new RagService(retrieval, ranker, knowledgeRepo);

    const embedding = await mockProvider.generateEmbedding('Paris is the capital of France');

    await vectorStore.upsert([
      {
        id: 'v1',
        organizationId: 'org1',
        chunkId: 'c1',
        documentId: 'd1',
        documentVersion: 1,
        embedding,
        metadata: { fileName: 'france.txt' },
      },
    ]);

    await docRepo.saveChunks([
      {
        id: 'c1',
        documentId: 'd1',
        organizationId: 'org1',
        version: 1,
        content: 'Paris is the capital of France',
        metadata: { fileName: 'france.txt' },
        tokenEstimate: 10,
        index: 0,
        createdAt: new Date().toISOString(),
      },
    ]);

    await knowledgeRepo.createDocument({
      id: 'd1',
      organizationId: 'org1',
      uploadedBy: 'user1',
      fileName: 'france.txt',
      fileSize: 50,
      mimeType: 'text/plain',
      source: 'upload',
      status: 'indexed',
      metadata: {},
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it('should return query results', async () => {
    const response = await ragService.query({
      query: 'What is the capital of France?',
      organizationId: 'org1',
      topK: 5,
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.citations.length).toBeGreaterThan(0);
    expect(response.query).toBe('What is the capital of France?');
    expect(response.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should include citations with document names', async () => {
    const response = await ragService.query({
      query: 'France capital',
      organizationId: 'org1',
    });

    for (const citation of response.citations) {
      expect(citation.documentName).toBeDefined();
      expect(citation.documentId).toBeDefined();
      expect(citation.chunkId).toBeDefined();
      expect(citation.content).toBeDefined();
      expect(typeof citation.score).toBe('number');
    }
  });

  it('should build context string', async () => {
    const result = await ragService.buildContextString({
      query: 'capital of France',
      organizationId: 'org1',
    });

    expect(result.context).toContain('France');
    expect(result.citations.length).toBeGreaterThan(0);
  });

  it('should enforce organization isolation', async () => {
    const response = await ragService.query({
      query: 'France capital',
      organizationId: 'org2',
    });

    expect(response.results).toHaveLength(0);
  });

  it('should support source priority reranking', async () => {
    const response = await ragService.queryWithSourcePriority(
      { query: 'France capital', organizationId: 'org1' },
      { upload: 0.1 },
    );

    expect(response.results).toBeDefined();
  });
});
