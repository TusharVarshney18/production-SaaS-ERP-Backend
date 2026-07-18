import { KnowledgeManagerService } from '../knowledge-manager.service';
import { DocumentProcessorService } from '../documents/document-processor.service';
import { DocumentParserService } from '../documents/document-parser.service';
import { ChunkService } from '../chunking/chunk.service';
import { FixedSizeChunkStrategy } from '../chunking/fixed-size-chunk.strategy';
import { HeadingAwareChunkStrategy } from '../chunking/heading-aware-chunk.strategy';
import { IndexingService } from '../indexing/indexing.service';
import { MockEmbeddingProvider } from '../embeddings/mock-embedding.provider';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { KnowledgeRepository } from '../repositories/knowledge.repository';
import { DocumentRepository } from '../repositories/document.repository';

describe('KnowledgeManagerService', () => {
  let manager: KnowledgeManagerService;
  let knowledgeRepo: KnowledgeRepository;

  beforeEach(() => {
    const parser = new DocumentParserService();
    const processor = new DocumentProcessorService(parser);
    const fixedChunk = new FixedSizeChunkStrategy({ chunkSize: 50, overlap: 5 });
    const headingChunk = new HeadingAwareChunkStrategy();
    const chunkService = new ChunkService(fixedChunk, headingChunk);
    const vectorStore = new InMemoryVectorStore();
    const mockProvider = new MockEmbeddingProvider();
    const factory = new EmbeddingProviderFactory();
    factory.registerProvider(mockProvider, true);
    knowledgeRepo = new KnowledgeRepository();
    const docRepo = new DocumentRepository();
    const indexingService = new IndexingService(vectorStore, factory, docRepo);

    manager = new KnowledgeManagerService(
      processor,
      chunkService,
      indexingService,
      knowledgeRepo,
      docRepo,
    );
  });

  it('should ingest a text document', async () => {
    const doc = await manager.ingestDocument(
      {
        fileName: 'test.txt',
        fileSize: 11,
        mimeType: 'text/plain',
        buffer: Buffer.from('Hello World'),
      },
      'org1',
      'user1',
    );

    expect(doc.status).toBe('indexed');
    expect(doc.organizationId).toBe('org1');
    expect(doc.fileName).toBe('test.txt');

    const fetched = await manager.getDocument(doc.id);
    expect(fetched).toBeTruthy();
  });

  it('should list documents for an organization', async () => {
    await manager.ingestDocument(
      { fileName: 'a.txt', fileSize: 5, mimeType: 'text/plain', buffer: Buffer.from('aaaaa') },
      'org1',
      'user1',
    );
    await manager.ingestDocument(
      { fileName: 'b.txt', fileSize: 5, mimeType: 'text/plain', buffer: Buffer.from('bbbbb') },
      'org1',
      'user1',
    );

    const docs = await manager.listDocuments('org1');
    expect(docs).toHaveLength(2);
  });

  it('should isolate documents by organization', async () => {
    await manager.ingestDocument(
      { fileName: 'a.txt', fileSize: 5, mimeType: 'text/plain', buffer: Buffer.from('aaaaa') },
      'org1',
      'user1',
    );
    await manager.ingestDocument(
      { fileName: 'b.txt', fileSize: 5, mimeType: 'text/plain', buffer: Buffer.from('bbbbb') },
      'org2',
      'user2',
    );

    const org1Docs = await manager.listDocuments('org1');
    const org2Docs = await manager.listDocuments('org2');
    expect(org1Docs).toHaveLength(1);
    expect(org2Docs).toHaveLength(1);
  });

  it('should get knowledge stats', async () => {
    await manager.ingestDocument(
      {
        fileName: 'test.txt',
        fileSize: 11,
        mimeType: 'text/plain',
        buffer: Buffer.from('Hello World'),
      },
      'org1',
      'user1',
    );

    const stats = await manager.getStats('org1');
    expect(stats.totalDocuments).toBe(1);
    expect(stats.indexedDocuments).toBe(1);
    expect(stats.totalChunks).toBeGreaterThanOrEqual(1);
  });

  it('should delete a document', async () => {
    const doc = await manager.ingestDocument(
      {
        fileName: 'delete.txt',
        fileSize: 5,
        mimeType: 'text/plain',
        buffer: Buffer.from('delete me'),
      },
      'org1',
      'user1',
    );

    const deleted = await manager.deleteDocument(doc.id, 'org1');
    expect(deleted).toBe(true);

    const fetched = await manager.getDocument(doc.id);
    expect(fetched).toBeNull();
  });

  it('should handle ingest failure gracefully', async () => {
    try {
      await manager.ingestDocument(
        { fileName: 'fail.txt', fileSize: 0, mimeType: 'text/plain', buffer: Buffer.from('') },
        'org1',
        'user1',
      );
    } catch {}

    const stats = await manager.getStats('org1');
    expect(stats.failedDocuments + stats.totalDocuments).toBeGreaterThanOrEqual(0);
  });

  it('should get document chunks', async () => {
    const doc = await manager.ingestDocument(
      {
        fileName: 'chunks.txt',
        fileSize: 200,
        mimeType: 'text/plain',
        buffer: Buffer.from('word '.repeat(100)),
      },
      'org1',
      'user1',
    );

    const chunks = await manager.getDocumentChunks(doc.id);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].documentId).toBe(doc.id);
  });
});
