export interface IEmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}
