import { ChunkService } from '../chunking/chunk.service';
import { FixedSizeChunkStrategy } from '../chunking/fixed-size-chunk.strategy';
import { HeadingAwareChunkStrategy } from '../chunking/heading-aware-chunk.strategy';

describe('ChunkService', () => {
  let service: ChunkService;

  beforeEach(() => {
    service = new ChunkService(new FixedSizeChunkStrategy(), new HeadingAwareChunkStrategy());
  });

  it('should use fixed-size strategy by default', () => {
    const strategy = service.getStrategy();
    expect(strategy.name).toBe('fixed-size');
  });

  it('should return named strategy', () => {
    const strategy = service.getStrategy('heading-aware');
    expect(strategy.name).toBe('heading-aware');
  });

  it('should fall back to default for unknown strategy', () => {
    const strategy = service.getStrategy('unknown');
    expect(strategy.name).toBe('fixed-size');
  });

  it('should chunk text with default strategy', async () => {
    const chunks = await service.chunk('hello world foo bar', 'fixed-size');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should chunk text with heading-aware strategy', async () => {
    const chunks = await service.chunk('# Title\nContent', 'heading-aware');
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should allow registering custom strategies', () => {
    const custom = { name: 'custom', chunk: jest.fn(), estimateTokens: jest.fn() };
    service.registerStrategy(custom);
    expect(service.getStrategy('custom')).toBe(custom);
  });
});
