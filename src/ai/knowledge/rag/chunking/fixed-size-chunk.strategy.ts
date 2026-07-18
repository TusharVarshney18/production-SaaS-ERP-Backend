import { Injectable } from '@nestjs/common';
import { IChunkStrategy, ChunkResult } from '../interfaces/chunk-strategy.interface';

export interface FixedSizeChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

@Injectable()
export class FixedSizeChunkStrategy implements IChunkStrategy {
  readonly name = 'fixed-size';

  private readonly defaultChunkSize = 512;
  private readonly defaultOverlap = 64;

  constructor(private readonly options?: FixedSizeChunkOptions) {}

  async chunk(text: string, metadata?: Record<string, unknown>): Promise<ChunkResult[]> {
    const chunkSize = this.options?.chunkSize ?? this.defaultChunkSize;
    const overlap = this.options?.overlap ?? this.defaultOverlap;
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
        tokenEstimate: this.estimateTokens(content),
      });

      i += chunkSize - overlap;
      index++;
    }

    return results;
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
