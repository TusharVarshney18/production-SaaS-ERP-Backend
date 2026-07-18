import { Injectable, Logger } from '@nestjs/common';
import { VectorSearchResult, IVectorStore } from '../interfaces/vector-store.interface';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { IDocumentRepository } from '../interfaces/repository.interface';
import { DocumentChunk } from '../dto/chunk.dto';
import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { RankerService } from './ranker.service';
import { RetrievalQuery, RetrievalResult } from '../dto/retrieval.dto';

@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);
  private readonly embeddingProvider: IEmbeddingProvider;
  private static readonly DEFAULT_TOP_K = 10;
  private static readonly SEARCH_MULTIPLIER = 2;

  constructor(
    private readonly vectorStore: IVectorStore,
    private readonly embeddingFactory: EmbeddingProviderFactory,
    private readonly documentRepository: IDocumentRepository,
    private readonly ranker: RankerService,
  ) {
    this.embeddingProvider = this.embeddingFactory.getProvider();
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult[]> {
    const startTime = Date.now();
    const topK = query.topK || HybridRetrievalService.DEFAULT_TOP_K;

    const queryEmbedding = await this.embeddingProvider.generateEmbedding(query.query);

    const vectorResults = await this.vectorStore.search(queryEmbedding, {
      organizationId: query.organizationId,
      limit: topK * HybridRetrievalService.SEARCH_MULTIPLIER,
      scoreThreshold: query.scoreThreshold,
      metadataFilter: query.metadataFilter,
      documentIds: query.documentIds,
    });

    const chunks = await this.resolveChunks(vectorResults);
    const ranked = await this.ranker.rank(chunks, topK);

    this.logger.debug(
      `Hybrid retrieval completed in ${Date.now() - startTime}ms, found ${ranked.length} results`,
    );

    return ranked;
  }

  private async resolveChunks(
    results: VectorSearchResult[],
  ): Promise<{ chunk: DocumentChunk; score: number }[]> {
    const resolved: { chunk: DocumentChunk; score: number }[] = [];

    for (const result of results) {
      const chunk = await this.documentRepository.getChunk(result.record.chunkId);
      if (chunk) {
        resolved.push({ chunk, score: result.score });
      }
    }

    return resolved;
  }
}
