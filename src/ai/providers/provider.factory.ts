import { Injectable, Logger } from '@nestjs/common';
import { IProvider } from '../interfaces/provider.interface';
import { InvalidProviderException } from '../exceptions/invalid-provider.exception';

@Injectable()
export class ProviderFactory {
  private readonly logger = new Logger(ProviderFactory.name);
  private readonly providers = new Map<string, IProvider>();

  registerProvider(provider: IProvider): void {
    const name = provider.name;
    if (this.providers.has(name)) {
      this.logger.warn(`Provider "${name}" is already registered. Overwriting.`);
    }
    this.providers.set(name, provider);
    this.logger.log(`AI provider registered: ${name} [${provider.models.join(', ')}]`);
  }

  getProvider(name: string): IProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new InvalidProviderException(name, this.getRegisteredProviders());
    }
    return provider;
  }

  getDefaultProvider(defaultName: string): IProvider {
    return this.getProvider(defaultName);
  }

  getByModel(model: string): IProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.models.includes(model)) {
        return provider;
      }
    }
    return undefined;
  }

  getByCapability(capability: 'chat' | 'embedding' | 'tools'): IProvider[] {
    const results: IProvider[] = [];
    for (const provider of this.providers.values()) {
      if (capability === 'chat' || capability === 'tools') {
        results.push(provider);
      } else if (
        provider.models.some(
          (m) => m.toLowerCase().includes('embedding') || m.toLowerCase().includes('embed'),
        )
      ) {
        results.push(provider);
      }
    }
    return results;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }

  getAvailableProviders(): IProvider[] {
    return [...this.providers.values()];
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  getProviderCount(): number {
    return this.providers.size;
  }
}
