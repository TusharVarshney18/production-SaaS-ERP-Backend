import { Injectable, Logger } from '@nestjs/common';
import { VectorSearchResult } from '../interfaces/vector-store.interface';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { InMemoryVectorStore } from '../vector/in-memory-vector.store';
import { DocumentRepository } from '../repositories/document.repository';
import { RankerService } from './ranker.service';
import { RetrievalQuery, RetrievalResult } from '../dto/retrieval.dto';

@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);
  private readonly embeddingProvider: IEmbeddingProvider;

  constructor(
    private readonly vectorStore: InMemoryVectorStore,
    private readonly embeddingFactory: EmbeddingProviderFactory,
    private readonly documentRepository: DocumentRepository,
    private readonly ranker: RankerService,
  ) {
    this.embeddingProvider = this.embeddingFactory.getProvider();
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult[]> {
    const startTime = Date.now();

    const queryEmbedding = await this.embeddingProvider.generateEmbedding(query.query);

    const vectorResults = await this.vectorStore.search(queryEmbedding, {
      organizationId: query.organizationId,
      limit: (query.topK || 10) * 2,
      scoreThreshold: query.scoreThreshold,
      metadataFilter: query.metadataFilter,
      documentIds: query.documentIds,
    });

    const chunks = await this.resolveChunks(vectorResults);
    const ranked = await this.ranker.rank(chunks, query.topK || 10);

    const duration = Date.now() - startTime;
    this.logger.debug(
      `Hybrid retrieval completed in ${duration}ms, found ${ranked.length} results`,
    );

    return ranked;
  }

  private async resolveChunks(
    results: VectorSearchResult[],
  ): Promise<{ chunk: import('../dto/chunk.dto').DocumentChunk; score: number }[]> {
    const resolved: { chunk: import('../dto/chunk.dto').DocumentChunk; score: number }[] = [];

    for (const result of results) {
      const chunk = await this.documentRepository.getChunk(result.record.chunkId);
      if (chunk) {
        resolved.push({ chunk, score: result.score });
      }
    }

    return resolved;
  }
}
