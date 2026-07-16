import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderFactory } from '../providers/provider.factory';
import { IProvider } from '../interfaces/provider.interface';
import { ProviderUnavailableException } from '../exceptions/provider-unavailable.exception';

export interface RouterOptions {
  preferredProvider?: string;
  model?: string;
  capability?: 'chat' | 'embedding' | 'tools';
  fallback?: boolean;
}

@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);

  constructor(
    private readonly factory: ProviderFactory,
    private readonly configService: ConfigService,
  ) {}

  async selectProvider(options?: RouterOptions): Promise<IProvider> {
    const opts = options || {};
    const defaultProvider = this.configService.get<string>('ai.defaultProvider') || 'openai';

    const candidates = this.buildCandidateList(opts, defaultProvider);

    for (const candidateName of candidates) {
      try {
        if (!this.factory.hasProvider(candidateName)) {
          this.logger.debug(`Provider "${candidateName}" not registered, skipping`);
          continue;
        }

        const provider = this.factory.getProvider(candidateName);
        const health = await provider.health();

        if (health.available && health.configured) {
          this.logger.debug(`Selected provider: ${candidateName}`);
          return provider;
        }

        this.logger.warn(
          `Provider "${candidateName}" unavailable (configured: ${health.configured}, available: ${health.available})`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to check provider "${candidateName}": ${(error as Error).message}`,
        );
      }
    }

    const lastResort = await this.tryAnyAvailable();
    if (lastResort) {
      this.logger.warn(`Falling back to any available provider: ${lastResort.name}`);
      return lastResort;
    }

    throw new ProviderUnavailableException('all', { attemptedProviders: candidates });
  }

  private buildCandidateList(options: RouterOptions, defaultProvider: string): string[] {
    const candidates: string[] = [];

    if (options.preferredProvider) {
      candidates.push(options.preferredProvider);
    }

    if (options.model) {
      const providerByModel = this.factory.getByModel(options.model);
      if (providerByModel && !candidates.includes(providerByModel.name)) {
        candidates.push(providerByModel.name);
      }
    }

    if (!candidates.includes(defaultProvider)) {
      candidates.push(defaultProvider);
    }

    const allProviders = this.factory.getRegisteredProviders();
    for (const p of allProviders) {
      if (!candidates.includes(p)) {
        candidates.push(p);
      }
    }

    return candidates;
  }

  private async tryAnyAvailable(): Promise<IProvider | null> {
    const allProviders = this.factory.getAvailableProviders();
    for (const provider of allProviders) {
      try {
        const health = await provider.health();
        if (health.available) return provider;
      } catch {
        continue;
      }
    }
    return null;
  }
}
