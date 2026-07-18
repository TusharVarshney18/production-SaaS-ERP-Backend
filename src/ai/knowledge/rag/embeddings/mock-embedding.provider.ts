import { Injectable } from '@nestjs/common';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';

@Injectable()
export class MockEmbeddingProvider implements IEmbeddingProvider {
  readonly name = 'mock';
  readonly dimensions = 384;

  private generateVector(): number[] {
    const vec: number[] = [];
    for (let i = 0; i < this.dimensions; i++) {
      vec.push(Math.random() * 2 - 1);
    }
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    return vec.map((v) => v / magnitude);
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return this.generateVector();
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return texts.map(() => this.generateVector());
  }
}
