import { FixedSizeChunkStrategy } from '../chunking/fixed-size-chunk.strategy';

describe('FixedSizeChunkStrategy', () => {
  it('should chunk text into fixed-size pieces', async () => {
    const strategy = new FixedSizeChunkStrategy({ chunkSize: 3, overlap: 0 });
    const text = 'a b c d e f g h i j';
    const chunks = await strategy.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].content.split(' ').length).toBeLessThanOrEqual(3);
  });

  it('should apply overlap', async () => {
    const strategy = new FixedSizeChunkStrategy({ chunkSize: 4, overlap: 1 });
    const text = 'a b c d e f g h';
    const chunks = await strategy.chunk(text);
    expect(chunks.length).toBeGreaterThan(1);
    if (chunks.length >= 2) {
      const firstWords = chunks[0].content.split(' ');
      const secondWords = chunks[1].content.split(' ');
      const overlap = firstWords.filter((w) => secondWords.includes(w));
      expect(overlap.length).toBeGreaterThan(0);
    }
  });

  it('should handle empty text', async () => {
    const strategy = new FixedSizeChunkStrategy();
    const chunks = await strategy.chunk('');
    expect(chunks).toHaveLength(0);
  });

  it('should preserve metadata', async () => {
    const strategy = new FixedSizeChunkStrategy({ chunkSize: 100, overlap: 0 });
    const chunks = await strategy.chunk('hello world', { source: 'test' });
    expect(chunks[0].metadata.source).toBe('test');
  });

  it('should estimate tokens', () => {
    const strategy = new FixedSizeChunkStrategy();
    const tokens = strategy.estimateTokens('hello world');
    expect(tokens).toBeGreaterThan(0);
  });
});
