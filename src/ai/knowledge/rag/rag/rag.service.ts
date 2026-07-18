import { Injectable, Logger } from '@nestjs/common';
import { HybridRetrievalService } from '../retrieval/hybrid-retrieval.service';
import { RankerService } from '../retrieval/ranker.service';
import { RetrievalQuery, RetrievalResult, Citation, RagResponse } from '../dto/retrieval.dto';
import { KnowledgeRepository } from '../repositories/knowledge.repository';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly retrievalService: HybridRetrievalService,
    private readonly ranker: RankerService,
    private readonly knowledgeRepository: KnowledgeRepository,
  ) {}

  async query(query: RetrievalQuery): Promise<RagResponse> {
    const startTime = Date.now();

    const results = await this.retrievalService.retrieve(query);

    const citations = await this.buildCitations(results);

    const totalResults = results.length;

    return {
      query: query.query,
      results,
      citations,
      totalResults,
      processingTimeMs: Date.now() - startTime,
    };
  }

  async queryWithSourcePriority(
    query: RetrievalQuery,
    sourcePriorities: Record<string, number>,
  ): Promise<RagResponse> {
    const startTime = Date.now();
    const results = await this.retrievalService.retrieve(query);
    const reranked = this.ranker.rerankBySourcePriority(results, sourcePriorities);
    const citations = await this.buildCitations(reranked);

    return {
      query: query.query,
      results: reranked,
      citations,
      totalResults: reranked.length,
      processingTimeMs: Date.now() - startTime,
    };
  }

  async buildContextString(
    query: RetrievalQuery,
  ): Promise<{ context: string; citations: Citation[] }> {
    const response = await this.query(query);

    const context = response.results
      .map((r) => {
        const source = r.chunk.metadata?.fileName || r.chunk.documentId;
        return `[Source: ${source} (relevance: ${(r.score * 100).toFixed(1)}%)]\n${r.chunk.content}`;
      })
      .join('\n\n---\n\n');

    return { context, citations: response.citations };
  }

  private async buildCitations(results: RetrievalResult[]): Promise<Citation[]> {
    const citations: Citation[] = [];

    for (const result of results) {
      const doc = await this.knowledgeRepository.getDocument(result.chunk.documentId);
      citations.push({
        chunkId: result.chunk.id,
        documentId: result.chunk.documentId,
        documentName: doc?.fileName || 'Unknown',
        content: result.chunk.content,
        score: result.score,
        metadata: {
          ...result.chunk.metadata,
          version: result.chunk.version,
        },
      });
    }

    return citations;
  }
}
