import { HeadingAwareChunkStrategy } from '../chunking/heading-aware-chunk.strategy';

describe('HeadingAwareChunkStrategy', () => {
  it('should split by headings', async () => {
    const strategy = new HeadingAwareChunkStrategy({ minChunkSize: 1, maxChunkSize: 1000 });
    const text = '# Introduction\nHello\n## Details\nMore info';
    const chunks = await strategy.chunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    const headingChunks = chunks.filter((c) => String(c.metadata.heading).includes('Introduction'));
    expect(headingChunks.length).toBeGreaterThan(0);
  });

  it('should preserve heading in chunk metadata', async () => {
    const strategy = new HeadingAwareChunkStrategy({ minChunkSize: 1, maxChunkSize: 1000 });
    const text = '# Title\nContent here';
    const chunks = await strategy.chunk(text);
    expect(chunks[0].metadata.heading).toContain('Title');
  });

  it('should handle text without headings', async () => {
    const strategy = new HeadingAwareChunkStrategy({ minChunkSize: 1, maxChunkSize: 1000 });
    const text = 'Just a plain paragraph.\nAnother paragraph.';
    const chunks = await strategy.chunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('should split across multiple sections by max chunk size', async () => {
    const strategy = new HeadingAwareChunkStrategy({ minChunkSize: 1, maxChunkSize: 50 });
    const text = '# Section 1\n' + 'word '.repeat(20) + '\n# Section 2\n' + 'more '.repeat(20);
    const chunks = await strategy.chunk(text);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});
