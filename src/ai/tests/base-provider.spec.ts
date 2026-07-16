import { BaseProvider } from '../providers/base-provider';
import { ProviderConfig } from '../dto/ai.types';
import { ProviderUnavailableException } from '../exceptions/provider-unavailable.exception';

class TestProvider extends BaseProvider {
  readonly name = 'test';
  readonly models = ['test-model'];

  constructor(config: ProviderConfig) {
    super(config);
  }

  async chat(): Promise<any> {
    return {};
  }
  async *stream(): AsyncIterable<any> {}
  async embed(): Promise<any> {
    return {};
  }
  async toolCall(): Promise<any> {
    return {};
  }
  async countTokens(text: string): Promise<number> {
    return text ? Math.ceil(text.length / 4) : 0;
  }

  protected async checkAvailability(): Promise<boolean> {
    return this.config.enabled;
  }
}

describe('BaseProvider', () => {
  describe('health', () => {
    it('should return healthy status when provider is available', async () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: true,
        defaultModel: 'test-model',
        models: {},
      });

      const health = await provider.health();
      expect(health.provider).toBe('test');
      expect(health.available).toBe(true);
      expect(health.configured).toBe(true);
      expect(health.latency).toBeGreaterThanOrEqual(0);
      expect(health.model).toBe('test-model');
    });

    it('should return unhealthy status when provider is unavailable', async () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: false,
        defaultModel: 'test-model',
        models: {},
      });

      const health = await provider.health();
      expect(health.available).toBe(false);
    });
  });

  describe('validateAvailability', () => {
    it('should not throw when provider is enabled', () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: true,
        defaultModel: 'test-model',
        models: {},
      });

      expect(() => provider['validateAvailability']()).not.toThrow();
    });

    it('should throw ProviderUnavailableException when provider is disabled', () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: false,
        defaultModel: 'test-model',
        models: {},
      });

      expect(() => provider['validateAvailability']()).toThrow(ProviderUnavailableException);
    });
  });

  describe('countTokens', () => {
    it('should return 0 for empty text', async () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: true,
        defaultModel: 'test-model',
        models: {},
      });

      expect(await provider.countTokens('')).toBe(0);
    });

    it('should estimate tokens based on text length', async () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: true,
        defaultModel: 'test-model',
        models: {},
      });

      const tokens = await provider.countTokens('Hello world, this is a test message');
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('maskApiKey', () => {
    it('should mask API key showing only first 4 and last 4 chars', () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: true,
        defaultModel: 'test-model',
        models: {},
      });

      const masked = provider['maskApiKey']('sk-1234567890abcdef');
      expect(masked).toBe('sk-1...cdef');
      expect(masked).not.toContain('1234567890');
    });

    it('should return *** for short keys', () => {
      const provider = new TestProvider({
        name: 'test',
        enabled: true,
        defaultModel: 'test-model',
        models: {},
      });

      expect(provider['maskApiKey']('short')).toBe('***');
    });
  });
});
