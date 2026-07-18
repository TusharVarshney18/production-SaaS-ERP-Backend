export interface ChunkResult {
  content: string;
  metadata: Record<string, unknown>;
  tokenEstimate: number;
}

export interface IChunkStrategy {
  readonly name: string;
  chunk(text: string, metadata?: Record<string, unknown>): Promise<ChunkResult[]>;
  estimateTokens(text: string): number;
}
