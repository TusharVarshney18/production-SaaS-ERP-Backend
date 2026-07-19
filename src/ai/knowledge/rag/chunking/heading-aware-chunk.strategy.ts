import { Injectable } from '@nestjs/common';
import { IChunkStrategy, ChunkResult } from '../interfaces/chunk-strategy.interface';
import {
  estimateTokens,
  RAG_DEFAULT_MIN_CHUNK_SIZE,
  RAG_DEFAULT_MAX_CHUNK_SIZE,
} from '../../../constants';

export interface HeadingAwareChunkOptions {
  minChunkSize?: number;
  maxChunkSize?: number;
}

@Injectable()
export class HeadingAwareChunkStrategy implements IChunkStrategy {
  readonly name = 'heading-aware';

  constructor(private readonly options?: HeadingAwareChunkOptions) {}

  async chunk(text: string, metadata?: Record<string, unknown>): Promise<ChunkResult[]> {
    const minSize = this.options?.minChunkSize ?? RAG_DEFAULT_MIN_CHUNK_SIZE;
    const maxSize = this.options?.maxChunkSize ?? RAG_DEFAULT_MAX_CHUNK_SIZE;
    const results: ChunkResult[] = [];

    const sections = this.splitByHeadings(text);
    let currentHeading = '';
    let currentContent = '';

    for (const section of sections) {
      if (section.isHeading) {
        if (currentContent.length >= minSize) {
          results.push(this.makeChunk(currentHeading, currentContent, metadata));
        } else if (results.length > 0) {
          const last = results[results.length - 1];
          last.content += '\n' + currentContent;
          last.tokenEstimate = estimateTokens(last.content);
        }
        currentHeading = section.text;
        currentContent = '';
      } else {
        currentContent += section.text + '\n';
      }

      if (currentContent.length > maxSize) {
        results.push(this.makeChunk(currentHeading, currentContent, metadata));
        currentContent = '';
      }
    }

    if (currentContent.trim().length > 0) {
      if (currentContent.length >= minSize || results.length === 0) {
        results.push(this.makeChunk(currentHeading, currentContent, metadata));
      } else {
        const last = results[results.length - 1];
        last.content += '\n' + currentContent;
        last.tokenEstimate = estimateTokens(last.content);
      }
    }

    return results.map((r, i) => ({
      ...r,
      metadata: { ...r.metadata, chunkIndex: i, strategy: this.name },
    }));
  }

  private splitByHeadings(text: string): { isHeading: boolean; text: string }[] {
    const lines = text.split('\n');
    const sections: { isHeading: boolean; text: string }[] = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/;

    for (const line of lines) {
      const match = line.match(headingRegex);
      if (match) {
        sections.push({ isHeading: true, text: `${match[1]} ${match[2]}` });
      } else {
        if (sections.length > 0 && !sections[sections.length - 1].isHeading) {
          sections[sections.length - 1].text += line + '\n';
        } else {
          sections.push({ isHeading: false, text: line + '\n' });
        }
      }
    }

    return sections;
  }

  private makeChunk(
    heading: string,
    content: string,
    baseMetadata?: Record<string, unknown>,
  ): ChunkResult {
    const fullContent = heading ? `${heading}\n${content.trim()}` : content.trim();
    return {
      content: fullContent,
      metadata: {
        ...baseMetadata,
        heading: heading || '(root)',
      },
      tokenEstimate: estimateTokens(fullContent),
    };
  }

  estimateTokens(text: string): number {
    return estimateTokens(text);
  }
}
