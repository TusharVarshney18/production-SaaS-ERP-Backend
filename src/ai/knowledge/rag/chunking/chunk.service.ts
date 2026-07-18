import { Injectable, Logger } from '@nestjs/common';
import { IChunkStrategy, ChunkResult } from '../interfaces/chunk-strategy.interface';
import { FixedSizeChunkStrategy } from './fixed-size-chunk.strategy';
import { HeadingAwareChunkStrategy } from './heading-aware-chunk.strategy';

@Injectable()
export class ChunkService {
  private readonly logger = new Logger(ChunkService.name);
  private readonly strategies = new Map<string, IChunkStrategy>();
  private readonly defaultStrategy: IChunkStrategy;

  constructor(
    fixedSizeStrategy: FixedSizeChunkStrategy,
    headingAwareStrategy: HeadingAwareChunkStrategy,
  ) {
    this.defaultStrategy = fixedSizeStrategy;
    this.registerStrategy(fixedSizeStrategy);
    this.registerStrategy(headingAwareStrategy);
  }

  registerStrategy(strategy: IChunkStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.logger.log(`Registered chunk strategy: ${strategy.name}`);
  }

  getStrategy(name?: string): IChunkStrategy {
    if (name && this.strategies.has(name)) {
      return this.strategies.get(name)!;
    }
    return this.defaultStrategy;
  }

  async chunk(
    text: string,
    strategyName?: string,
    metadata?: Record<string, unknown>,
  ): Promise<ChunkResult[]> {
    const strategy = this.getStrategy(strategyName);
    return strategy.chunk(text, metadata);
  }

  estimateTokens(text: string): number {
    return this.defaultStrategy.estimateTokens(text);
  }
}
