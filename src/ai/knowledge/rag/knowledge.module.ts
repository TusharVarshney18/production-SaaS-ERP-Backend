import { Module } from '@nestjs/common';
import { EmbeddingProviderFactory } from './embeddings/embedding-provider.factory';
import { MockEmbeddingProvider } from './embeddings/mock-embedding.provider';
import { InMemoryVectorStore } from './vector/in-memory-vector.store';
import { DocumentParserService } from './documents/document-parser.service';
import { DocumentProcessorService } from './documents/document-processor.service';
import { FixedSizeChunkStrategy } from './chunking/fixed-size-chunk.strategy';
import { HeadingAwareChunkStrategy } from './chunking/heading-aware-chunk.strategy';
import { ChunkService } from './chunking/chunk.service';
import { KnowledgeRepository } from './repositories/knowledge.repository';
import { DocumentRepository } from './repositories/document.repository';
import { HybridRetrievalService } from './retrieval/hybrid-retrieval.service';
import { RankerService } from './retrieval/ranker.service';
import { IndexingService } from './indexing/indexing.service';
import { RagService } from './rag/rag.service';
import { KnowledgeManagerService } from './knowledge-manager.service';

@Module({
  providers: [
    EmbeddingProviderFactory,
    MockEmbeddingProvider,
    InMemoryVectorStore,
    DocumentParserService,
    DocumentProcessorService,
    FixedSizeChunkStrategy,
    HeadingAwareChunkStrategy,
    ChunkService,
    KnowledgeRepository,
    DocumentRepository,
    HybridRetrievalService,
    RankerService,
    IndexingService,
    RagService,
    KnowledgeManagerService,
  ],
  exports: [
    EmbeddingProviderFactory,
    InMemoryVectorStore,
    ChunkService,
    KnowledgeRepository,
    DocumentRepository,
    HybridRetrievalService,
    RankerService,
    IndexingService,
    RagService,
    KnowledgeManagerService,
  ],
})
export class KnowledgeModule {}
