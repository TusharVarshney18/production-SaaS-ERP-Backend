import { Injectable, Logger } from '@nestjs/common';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { MockEmbeddingProvider } from './mock-embedding.provider';

@Injectable()
export class EmbeddingProviderFactory {
  private readonly logger = new Logger(EmbeddingProviderFactory.name);
  private readonly providers = new Map<string, IEmbeddingProvider>();

  constructor(private readonly mockProvider: MockEmbeddingProvider) {
    this.registerProvider(this.mockProvider);
  }

  registerProvider(provider: IEmbeddingProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered embedding provider: ${provider.name} (${provider.dimensions}d)`);
  }

  getProvider(name?: string): IEmbeddingProvider {
    if (name && this.providers.has(name)) {
      return this.providers.get(name)!;
    }
    return this.mockProvider;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}
