import { ProviderFactory } from '../providers/provider.factory';
import { IProvider } from '../interfaces/provider.interface';
import { InvalidProviderException } from '../exceptions/invalid-provider.exception';

describe('ProviderFactory', () => {
  let factory: ProviderFactory;

  const mockProvider: IProvider = {
    name: 'test_provider',
    models: ['model-a', 'model-b'],
    chat: jest.fn(),
    stream: jest.fn(),
    embed: jest.fn(),
    toolCall: jest.fn(),
    health: jest.fn(),
    countTokens: jest.fn(),
  };

  const mockEmbeddingProvider: IProvider = {
    name: 'embed_provider',
    models: ['embed-model'],
    chat: jest.fn(),
    stream: jest.fn(),
    embed: jest.fn(),
    toolCall: jest.fn(),
    health: jest.fn(),
    countTokens: jest.fn(),
  };

  beforeEach(() => {
    factory = new ProviderFactory();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      factory.registerProvider(mockProvider);

      expect(factory.hasProvider('test_provider')).toBe(true);
      expect(factory.getRegisteredProviders()).toContain('test_provider');
    });

    it('should allow registering multiple providers', () => {
      factory.registerProvider(mockProvider);
      factory.registerProvider(mockEmbeddingProvider);

      expect(factory.getProviderCount()).toBe(2);
    });
  });

  describe('getProvider', () => {
    it('should return a registered provider', () => {
      factory.registerProvider(mockProvider);

      const provider = factory.getProvider('test_provider');
      expect(provider).toBe(mockProvider);
    });

    it('should throw InvalidProviderException for unregistered provider', () => {
      expect(() => factory.getProvider('nonexistent')).toThrow(InvalidProviderException);
    });

    it('should list available providers in error message', () => {
      factory.registerProvider(mockProvider);

      try {
        factory.getProvider('unknown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidProviderException);
        expect((error as InvalidProviderException).message).toContain('test_provider');
      }
    });
  });

  describe('getDefaultProvider', () => {
    it('should return provider by default name', () => {
      factory.registerProvider(mockProvider);

      const provider = factory.getDefaultProvider('test_provider');
      expect(provider).toBe(mockProvider);
    });

    it('should throw for unregistered default', () => {
      expect(() => factory.getDefaultProvider('missing')).toThrow(InvalidProviderException);
    });
  });

  describe('getByModel', () => {
    it('should find provider by model name', () => {
      factory.registerProvider(mockProvider);

      const provider = factory.getByModel('model-a');
      expect(provider).toBe(mockProvider);
    });

    it('should return undefined for unknown model', () => {
      factory.registerProvider(mockProvider);

      const provider = factory.getByModel('unknown-model');
      expect(provider).toBeUndefined();
    });
  });

  describe('getByCapability', () => {
    it('should return providers for chat capability', () => {
      factory.registerProvider(mockProvider);
      factory.registerProvider(mockEmbeddingProvider);

      const providers = factory.getByCapability('chat');
      expect(providers.length).toBe(2);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should return empty array initially', () => {
      expect(factory.getRegisteredProviders()).toEqual([]);
    });

    it('should return list of registered provider names', () => {
      factory.registerProvider(mockProvider);
      factory.registerProvider(mockEmbeddingProvider);

      const providers = factory.getRegisteredProviders();
      expect(providers).toContain('test_provider');
      expect(providers).toContain('embed_provider');
    });
  });

  describe('hasProvider', () => {
    it('should return true for registered provider', () => {
      factory.registerProvider(mockProvider);
      expect(factory.hasProvider('test_provider')).toBe(true);
    });

    it('should return false for unregistered provider', () => {
      expect(factory.hasProvider('unknown')).toBe(false);
    });
  });

  describe('getProviderCount', () => {
    it('should return 0 initially', () => {
      expect(factory.getProviderCount()).toBe(0);
    });

    it('should return correct count', () => {
      factory.registerProvider(mockProvider);
      factory.registerProvider(mockEmbeddingProvider);
      expect(factory.getProviderCount()).toBe(2);
    });
  });
});
