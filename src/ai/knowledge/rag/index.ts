export { KnowledgeModule } from './knowledge.module';
export { KnowledgeManagerService } from './knowledge-manager.service';
export { RagService } from './rag/rag.service';
export { EmbeddingProviderFactory } from './embeddings/embedding-provider.factory';
export { MockEmbeddingProvider } from './embeddings/mock-embedding.provider';
export { InMemoryVectorStore } from './vector/in-memory-vector.store';
export { ChunkService } from './chunking/chunk.service';
export { FixedSizeChunkStrategy, HeadingAwareChunkStrategy } from './chunking/index';
export { HybridRetrievalService } from './retrieval/hybrid-retrieval.service';
export { RankerService } from './retrieval/ranker.service';
export { IndexingService } from './indexing/indexing.service';
export { KnowledgeRepository } from './repositories/knowledge.repository';
export { DocumentRepository } from './repositories/document.repository';
export { DocumentParserService } from './documents/document-parser.service';
export { DocumentProcessorService } from './documents/document-processor.service';
export { IEmbeddingProvider } from './interfaces/embedding-provider.interface';
export {
  IVectorStore,
  VectorRecord,
  VectorSearchResult,
  VectorSearchOptions,
} from './interfaces/vector-store.interface';
export { IChunkStrategy, ChunkResult } from './interfaces/chunk-strategy.interface';
export { IDocumentParser, ParsedDocument } from './interfaces/document-parser.interface';
export {
  KnowledgeDocument,
  DocumentUploadInput,
  DocumentVersion,
  DocumentSource,
  DocumentStatus,
} from './dto/document.dto';
export { DocumentChunk } from './dto/chunk.dto';
export { RetrievalQuery, RetrievalResult, Citation, RagResponse } from './dto/retrieval.dto';
export { KnowledgeStats } from './dto/knowledge.dto';
