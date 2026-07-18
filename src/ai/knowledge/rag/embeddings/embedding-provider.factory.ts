import { Injectable, Logger } from '@nestjs/common';
import { IEmbeddingProvider } from '../interfaces/embedding-provider.interface';

@Injectable()
export class EmbeddingProviderFactory {
  private readonly logger = new Logger(EmbeddingProviderFactory.name);
  private readonly providers = new Map<string, IEmbeddingProvider>();
  private defaultProvider: IEmbeddingProvider;

  registerProvider(provider: IEmbeddingProvider, isDefault?: boolean): void {
    this.providers.set(provider.name, provider);
    if (isDefault || !this.defaultProvider) {
      this.defaultProvider = provider;
    }
    this.logger.log(`Registered embedding provider: ${provider.name} (${provider.dimensions}d)`);
  }

  getProvider(name?: string): IEmbeddingProvider {
    if (name && this.providers.has(name)) {
      return this.providers.get(name)!;
    }
    return this.defaultProvider;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}
