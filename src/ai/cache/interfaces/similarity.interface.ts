export interface SimilarityResult {
  key: string;
  value: unknown;
  score: number;
  metadata: Record<string, unknown>;
}

export interface MatchOptions {
  minScore: number;
  maxResults: number;
  useSemanticFallback: boolean;
}

export interface ISimilarityMatcher {
  findSimilar(
    input: string,
    organizationId: string,
    category: string,
    options?: Partial<MatchOptions>,
  ): Promise<SimilarityResult[]>;
  findSimilarByEmbedding(
    embedding: number[],
    organizationId: string,
    category: string,
    options?: Partial<MatchOptions>,
  ): Promise<SimilarityResult[]>;
  computeSimilarity(a: string, b: string): number;
  cosineSimilarity(a: number[], b: number[]): number;
}
