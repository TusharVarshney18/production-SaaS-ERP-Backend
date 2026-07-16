import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIGatewayService } from '../core/ai-gateway.service';
import { ProviderRouterService } from '../core/provider-router.service';
import { ProviderFactory } from '../providers/provider.factory';
import { IProvider } from '../interfaces/provider.interface';

describe('AIGatewayService', () => {
  let gateway: AIGatewayService;
  let factory: ProviderFactory;

  const mockProvider: IProvider = {
    name: 'test_provider',
    models: ['test-model'],
    chat: jest.fn().mockResolvedValue({
      message: { role: 'assistant', content: 'response' },
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 },
      model: 'test-model',
      latency: 100,
      finishReason: 'stop',
    }),
    stream: jest.fn(),
    embed: jest.fn().mockResolvedValue({
      embedding: [0.1, 0.2],
      model: 'test-embed',
      usage: { promptTokens: 3, totalTokens: 3 },
    }),
    toolCall: jest.fn(),
    health: jest.fn().mockResolvedValue({
      provider: 'test_provider',
      available: true,
      latency: 50,
      configured: true,
      model: 'test-model',
    }),
    countTokens: jest.fn(),
  };

  beforeEach(async () => {
    factory = new ProviderFactory();
    factory.registerProvider(mockProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIGatewayService,
        ProviderRouterService,
        { provide: ProviderFactory, useValue: factory },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test_provider') },
        },
      ],
    }).compile();

    gateway = module.get<AIGatewayService>(AIGatewayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('should route chat requests to a provider', async () => {
      const response = await gateway.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(response.message.content).toBe('response');
      expect(response.usage.totalTokens).toBe(15);
    });
  });

  describe('embed', () => {
    it('should route embedding requests to a provider', async () => {
      const result = await gateway.embed('test text');

      expect(result.embedding).toEqual([0.1, 0.2]);
      expect(result.model).toBe('test-embed');
    });
  });

  describe('healthCheck', () => {
    it('should return health for all providers', async () => {
      const results = await gateway.healthCheck();

      expect(results).toHaveLength(1);
      expect(results[0].provider).toBe('test_provider');
      expect(results[0].available).toBe(true);
    });
  });

  describe('getRegisteredProviders', () => {
    it('should list registered providers', () => {
      const providers = gateway.getRegisteredProviders();
      expect(providers).toContain('test_provider');
    });
  });
});
