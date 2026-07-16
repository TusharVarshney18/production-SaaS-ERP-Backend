import { Test, TestingModule } from '@nestjs/testing';
import { AIHealthService } from '../health/ai-health.service';
import { AIGatewayService } from '../core/ai-gateway.service';
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderRouterService } from '../core/provider-router.service';
import { ConfigService } from '@nestjs/config';
import { IProvider } from '../interfaces/provider.interface';

describe('AIHealthService', () => {
  let healthService: AIHealthService;

  const mockHealthyProvider: IProvider = {
    name: 'openai',
    models: ['gpt-4o'],
    chat: jest.fn(),
    stream: jest.fn(),
    embed: jest.fn(),
    toolCall: jest.fn(),
    health: jest.fn().mockResolvedValue({
      provider: 'openai',
      available: true,
      latency: 150,
      configured: true,
      model: 'gpt-4o',
    }),
    countTokens: jest.fn(),
  };

  const mockUnhealthyProvider: IProvider = {
    name: 'gemini',
    models: ['gemini-pro'],
    chat: jest.fn(),
    stream: jest.fn(),
    embed: jest.fn(),
    toolCall: jest.fn(),
    health: jest.fn().mockResolvedValue({
      provider: 'gemini',
      available: false,
      latency: 0,
      configured: true,
      model: 'gemini-pro',
    }),
    countTokens: jest.fn(),
  };

  beforeEach(async () => {
    const factory = new ProviderFactory();
    factory.registerProvider(mockHealthyProvider);
    factory.registerProvider(mockUnhealthyProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIHealthService,
        AIGatewayService,
        ProviderRouterService,
        { provide: ProviderFactory, useValue: factory },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('openai') },
        },
      ],
    }).compile();

    healthService = module.get<AIHealthService>(AIHealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('check', () => {
    it('should return health check results for all providers', async () => {
      const result = await healthService.check();

      expect(result).toBeDefined();
      expect(result.status).toBe('degraded');
      expect(result.timestamp).toBeDefined();
      expect(result.providers).toHaveLength(2);
    });

    it('should return ok when all providers are healthy', async () => {
      const healthyOnly = new ProviderFactory();
      healthyOnly.registerProvider(mockHealthyProvider);

      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          AIHealthService,
          AIGatewayService,
          ProviderRouterService,
          { provide: ProviderFactory, useValue: healthyOnly },
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('openai') } },
        ],
      }).compile();

      const testService = testModule.get<AIHealthService>(AIHealthService);
      const result = await testService.check();

      expect(result.status).toBe('ok');
    });
  });

  describe('providerHealth', () => {
    it('should return health for a specific provider', async () => {
      const health = await healthService.providerHealth('openai');
      expect(health).toBeDefined();
      expect(health!.provider).toBe('openai');
      expect(health!.available).toBe(true);
    });

    it('should return null for unknown provider', async () => {
      const health = await healthService.providerHealth('unknown');
      expect(health).toBeNull();
    });
  });
});
