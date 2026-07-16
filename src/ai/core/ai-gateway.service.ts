import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderFactory } from '../providers/provider.factory';
import { ProviderRouterService, RouterOptions } from './provider-router.service';
import { IProvider } from '../interfaces/provider.interface';
import { ChatRequest, ChatResponse, EmbeddingResponse, ProviderHealth } from '../dto/ai.types';

@Injectable()
export class AIGatewayService {
  private readonly logger = new Logger(AIGatewayService.name);

  constructor(
    private readonly factory: ProviderFactory,
    private readonly router: ProviderRouterService,
    private readonly configService: ConfigService,
  ) {}

  async chat(request: ChatRequest, options?: RouterOptions): Promise<ChatResponse> {
    const provider = await this.router.selectProvider(options);
    return provider.chat(request);
  }

  async stream(
    request: ChatRequest,
    options?: RouterOptions,
  ): Promise<AsyncIterable<ChatResponse>> {
    const provider = await this.router.selectProvider(options);
    return provider.stream(request);
  }

  async embed(text: string, options?: RouterOptions): Promise<EmbeddingResponse> {
    const provider = await this.router.selectProvider({
      ...options,
      capability: 'embedding',
    });
    return provider.embed(text);
  }

  async toolCall(request: ChatRequest, options?: RouterOptions): Promise<ChatResponse> {
    const provider = await this.router.selectProvider({
      ...options,
      capability: 'tools',
    });
    return provider.toolCall(request);
  }

  async healthCheck(): Promise<ProviderHealth[]> {
    const providers = this.factory.getAvailableProviders();
    const results: ProviderHealth[] = [];

    for (const provider of providers) {
      try {
        const health = await provider.health();
        results.push(health);
      } catch (error) {
        this.logger.error(`Health check failed for ${provider.name}: ${(error as Error).message}`);
        results.push({
          provider: provider.name,
          available: false,
          latency: 0,
          configured: true,
          model: provider.models[0] || '',
        });
      }
    }

    return results;
  }

  getRegisteredProviders(): string[] {
    return this.factory.getRegisteredProviders();
  }

  getProvider(name: string): IProvider {
    return this.factory.getProvider(name);
  }
}
