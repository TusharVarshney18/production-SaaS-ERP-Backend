import { Logger } from '@nestjs/common';
import { IProvider } from '../interfaces/provider.interface';
import {
  ChatRequest,
  ChatResponse,
  EmbeddingResponse,
  ProviderHealth,
  ProviderConfig,
} from '../dto/ai.types';
import { ProviderUnavailableException } from '../exceptions/provider-unavailable.exception';

export abstract class BaseProvider implements IProvider {
  protected readonly logger: Logger;
  abstract readonly name: string;
  abstract readonly models: string[];

  constructor(protected readonly config: ProviderConfig) {
    this.logger = new Logger(`${this.constructor.name}`);
  }

  abstract chat(request: ChatRequest): Promise<ChatResponse>;
  abstract stream(request: ChatRequest): AsyncIterable<ChatResponse>;
  abstract embed(text: string): Promise<EmbeddingResponse>;
  abstract toolCall(request: ChatRequest): Promise<ChatResponse>;
  abstract countTokens(text: string): Promise<number>;

  async health(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const available = await this.checkAvailability();
      return {
        provider: this.name,
        available,
        latency: Date.now() - start,
        configured: this.config.enabled,
        model: this.config.defaultModel,
      };
    } catch {
      return {
        provider: this.name,
        available: false,
        latency: Date.now() - start,
        configured: this.config.enabled,
        model: this.config.defaultModel,
      };
    }
  }

  protected abstract checkAvailability(): Promise<boolean>;

  protected validateAvailability(): void {
    if (!this.config.enabled) {
      throw new ProviderUnavailableException(this.name, {
        reason: 'Provider is disabled in configuration',
      });
    }
  }

  protected maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  protected get enabledLogging(): boolean {
    return this.config.enabled;
  }
}
