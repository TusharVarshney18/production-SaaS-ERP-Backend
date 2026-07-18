import { Injectable } from '@nestjs/common';
import { RetrievalResult } from '../dto/retrieval.dto';
import { DocumentChunk } from '../dto/chunk.dto';

@Injectable()
export class RankerService {
  async rank(
    chunks: { chunk: DocumentChunk; score: number }[],
    topK?: number,
  ): Promise<RetrievalResult[]> {
    const ranked = chunks
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({
        chunk: item.chunk,
        score: item.score,
        rank: index + 1,
      }));

    const limit = topK || 10;
    return ranked.slice(0, limit);
  }

  rerankBySourcePriority(
    results: RetrievalResult[],
    sourcePriorities: Record<string, number>,
  ): RetrievalResult[] {
    return results
      .map((r) => {
        const source = (r.chunk.metadata?.source as string) || 'upload';
        const priorityBoost = sourcePriorities[source] || 0;
        return {
          ...r,
          score: r.score + priorityBoost,
        };
      })
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }
}
