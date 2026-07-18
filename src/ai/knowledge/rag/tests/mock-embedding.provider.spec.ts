import { MockEmbeddingProvider } from '../embeddings/mock-embedding.provider';

describe('MockEmbeddingProvider', () => {
  let provider: MockEmbeddingProvider;

  beforeEach(() => {
    provider = new MockEmbeddingProvider();
  });

  it('should have name and dimensions', () => {
    expect(provider.name).toBe('mock');
    expect(provider.dimensions).toBe(384);
  });

  it('should generate single embedding', async () => {
    const embedding = await provider.generateEmbedding('hello world');
    expect(embedding).toHaveLength(384);
    expect(embedding.every((v) => typeof v === 'number')).toBe(true);
  });

  it('should generate multiple embeddings', async () => {
    const embeddings = await provider.generateEmbeddings(['hello', 'world']);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(384);
    expect(embeddings[1]).toHaveLength(384);
  });

  it('should produce unit vectors', async () => {
    const embedding = await provider.generateEmbedding('test');
    const magnitude = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    expect(magnitude).toBeCloseTo(1, 1);
  });

  it('should produce different vectors for different inputs', async () => {
    const [a, b] = await provider.generateEmbeddings(['aaa', 'bbb']);
    const areEqual = a.every((v, i) => v === b[i]);
    expect(areEqual).toBe(false);
  });
});
