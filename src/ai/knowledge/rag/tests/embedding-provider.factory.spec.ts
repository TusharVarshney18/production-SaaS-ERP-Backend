import { EmbeddingProviderFactory } from '../embeddings/embedding-provider.factory';
import { MockEmbeddingProvider } from '../embeddings/mock-embedding.provider';

describe('EmbeddingProviderFactory', () => {
  let factory: EmbeddingProviderFactory;
  let mockProvider: MockEmbeddingProvider;

  beforeEach(() => {
    mockProvider = new MockEmbeddingProvider();
    factory = new EmbeddingProviderFactory(mockProvider);
  });

  it('should register mock provider on init', () => {
    expect(factory.getRegisteredProviders()).toContain('mock');
  });

  it('should return mock provider by default', () => {
    const provider = factory.getProvider();
    expect(provider.name).toBe('mock');
  });

  it('should return provider by name', () => {
    const provider = factory.getProvider('mock');
    expect(provider.name).toBe('mock');
  });

  it('should return mock for unknown name', () => {
    const provider = factory.getProvider('nonexistent');
    expect(provider.name).toBe('mock');
  });

  it('should check provider existence', () => {
    expect(factory.hasProvider('mock')).toBe(true);
    expect(factory.hasProvider('openai')).toBe(false);
  });

  it('should allow registering custom providers', () => {
    const custom = {
      name: 'custom',
      dimensions: 128,
      generateEmbedding: jest.fn(),
      generateEmbeddings: jest.fn(),
    };
    factory.registerProvider(custom);
    expect(factory.hasProvider('custom')).toBe(true);
    expect(factory.getProvider('custom')).toBe(custom);
  });
});
