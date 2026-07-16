import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ProviderRouterService } from '../core/provider-router.service';
import { ProviderFactory } from '../providers/provider.factory';
import { IProvider } from '../interfaces/provider.interface';
import { ProviderUnavailableException } from '../exceptions/provider-unavailable.exception';

describe('ProviderRouterService', () => {
  let router: ProviderRouterService;
  let factory: ProviderFactory;
  let configService: ConfigService;

  const mockHealthyProvider: IProvider = {
    name: 'healthy_provider',
    models: ['model-a'],
    chat: jest.fn(),
    stream: jest.fn(),
    embed: jest.fn(),
    toolCall: jest.fn(),
    health: jest.fn().mockResolvedValue({
      provider: 'healthy_provider',
      available: true,
      latency: 100,
      configured: true,
      model: 'model-a',
    }),
    countTokens: jest.fn(),
  };

  const mockUnhealthyProvider: IProvider = {
    name: 'unhealthy_provider',
    models: ['model-b'],
    chat: jest.fn(),
    stream: jest.fn(),
    embed: jest.fn(),
    toolCall: jest.fn(),
    health: jest.fn().mockResolvedValue({
      provider: 'unhealthy_provider',
      available: false,
      latency: 100,
      configured: true,
      model: 'model-b',
    }),
    countTokens: jest.fn(),
  };

  beforeEach(async () => {
    factory = new ProviderFactory();
    factory.registerProvider(mockHealthyProvider);
    factory.registerProvider(mockUnhealthyProvider);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderRouterService,
        {
          provide: ProviderFactory,
          useValue: factory,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('healthy_provider'),
          },
        },
      ],
    }).compile();

    router = module.get<ProviderRouterService>(ProviderRouterService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('selectProvider', () => {
    it('should select a healthy provider', async () => {
      const provider = await router.selectProvider();
      expect(provider).toBe(mockHealthyProvider);
    });

    it('should prefer specified provider', async () => {
      const healthy2: IProvider = {
        name: 'healthy2',
        models: ['model-c'],
        chat: jest.fn(),
        stream: jest.fn(),
        embed: jest.fn(),
        toolCall: jest.fn(),
        health: jest.fn().mockResolvedValue({
          provider: 'healthy2',
          available: true,
          latency: 50,
          configured: true,
          model: 'model-c',
        }),
        countTokens: jest.fn(),
      };
      factory.registerProvider(healthy2);

      const provider = await router.selectProvider({ preferredProvider: 'healthy2' });
      expect(provider).toBe(healthy2);
    });

    it('should skip unhealthy providers and try next', async () => {
      jest.spyOn(configService, 'get').mockReturnValue('unhealthy_provider');

      const provider = await router.selectProvider();
      expect(provider).toBe(mockHealthyProvider);
    });

    it('should throw ProviderUnavailableException when all providers fail', async () => {
      const factory2 = new ProviderFactory();
      factory2.registerProvider(mockUnhealthyProvider);

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ProviderRouterService,
          { provide: ProviderFactory, useValue: factory2 },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('unhealthy_provider') },
          },
        ],
      }).compile();

      const router2 = module.get<ProviderRouterService>(ProviderRouterService);
      await expect(router2.selectProvider()).rejects.toThrow(ProviderUnavailableException);
    });
  });
});
