import { IProvider } from '../interfaces/provider.interface';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderHealth } from '../dto/ai.types';

class MockProvider implements IProvider {
  readonly name = 'mock';
  readonly models = ['mock-model'];
  private shouldFail = false;

  setFail(fail: boolean) {
    this.shouldFail = fail;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (this.shouldFail) throw new Error('Mock failure');
    return {
      message: { role: 'assistant', content: `Echo: ${request.messages[0]?.content}` },
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model',
      latency: 50,
      finishReason: 'stop',
    };
  }

  async *stream(_request: ChatRequest): AsyncIterable<ChatResponse> {
    if (this.shouldFail) throw new Error('Mock stream failure');
    yield {
      message: { role: 'assistant', content: 'chunk' },
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      model: 'mock-model',
      latency: 0,
      finishReason: '',
    };
  }

  async embed(_text: string): Promise<EmbeddingResponse> {
    if (this.shouldFail) throw new Error('Mock embed failure');
    return {
      embedding: [0.1, 0.2, 0.3],
      model: 'mock-embed',
      usage: { promptTokens: 5, totalTokens: 5 },
    };
  }

  async toolCall(request: ChatRequest): Promise<ChatResponse> {
    return this.chat(request);
  }

  async health(): Promise<ProviderHealth> {
    return {
      provider: 'mock',
      available: !this.shouldFail,
      latency: 10,
      configured: true,
      model: 'mock-model',
    };
  }

  async countTokens(_text: string): Promise<number> {
    return _text.length;
  }
}

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
  });

  describe('chat', () => {
    it('should echo back the user message', async () => {
      const response = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.message.content).toBe('Echo: Hello');
      expect(response.model).toBe('mock-model');
      expect(response.usage.totalTokens).toBe(30);
      expect(response.latency).toBe(50);
    });

    it('should throw on failure', async () => {
      provider.setFail(true);
      await expect(
        provider.chat({
          messages: [{ role: 'user', content: 'test' }],
        }),
      ).rejects.toThrow('Mock failure');
    });
  });

  describe('stream', () => {
    it('should yield chunks', async () => {
      const chunks: any[] = [];
      for await (const chunk of provider.stream({
        messages: [{ role: 'user', content: 'test' }],
      })) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(1);
      expect(chunks[0].message.content).toBe('chunk');
    });

    it('should throw on failure', async () => {
      provider.setFail(true);
      const iterator = provider
        .stream({
          messages: [{ role: 'user', content: 'test' }],
        })
        [Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow('Mock stream failure');
    });
  });

  describe('embed', () => {
    it('should return embeddings', async () => {
      const result = await provider.embed('test text');

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
      expect(result.model).toBe('mock-embed');
    });

    it('should throw on failure', async () => {
      provider.setFail(true);
      await expect(provider.embed('test')).rejects.toThrow('Mock embed failure');
    });
  });

  describe('health', () => {
    it('should return healthy when not failing', async () => {
      const health = await provider.health();
      expect(health.available).toBe(true);
    });

    it('should return unhealthy when failing', async () => {
      provider.setFail(true);
      const health = await provider.health();
      expect(health.available).toBe(false);
    });
  });

  describe('countTokens', () => {
    it('should return text length', async () => {
      const count = await provider.countTokens('hello');
      expect(count).toBe(5);
    });
  });
});
