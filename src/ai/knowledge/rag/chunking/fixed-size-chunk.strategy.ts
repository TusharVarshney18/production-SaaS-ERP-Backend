import { Injectable } from '@nestjs/common';
import { IChunkStrategy, ChunkResult } from '../interfaces/chunk-strategy.interface';
import { estimateTokens, RAG_DEFAULT_CHUNK_SIZE, RAG_DEFAULT_OVERLAP } from '../../../constants';

export interface FixedSizeChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

@Injectable()
export class FixedSizeChunkStrategy implements IChunkStrategy {
  readonly name = 'fixed-size';

  constructor(private readonly options?: FixedSizeChunkOptions) {}

  async chunk(text: string, metadata?: Record<string, unknown>): Promise<ChunkResult[]> {
    const chunkSize = this.options?.chunkSize ?? RAG_DEFAULT_CHUNK_SIZE;
    const overlap = this.options?.overlap ?? RAG_DEFAULT_OVERLAP;
    const results: ChunkResult[] = [];

    const words = text.split(/\s+/);
    let i = 0;
    let index = 0;

    if (words.length === 0 || (words.length === 1 && words[0] === '')) {
      return results;
    }

    while (i < words.length) {
      const chunkWords = words.slice(i, i + chunkSize);
      if (chunkWords.length === 0) break;

      const content = chunkWords.join(' ');
      results.push({
        content,
        metadata: {
          ...metadata,
          chunkIndex: index,
          wordCount: chunkWords.length,
          strategy: this.name,
        },
        tokenEstimate: estimateTokens(content),
      });

      i += chunkSize - overlap;
      index++;
    }

    return results;
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}
