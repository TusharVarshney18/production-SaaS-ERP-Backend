import { AIException } from './ai.exception';

export class ProviderUnavailableException extends AIException {
  constructor(providerName: string, details?: Record<string, unknown>) {
    super(`Provider "${providerName}" is currently unavailable`, 'PROVIDER_UNAVAILABLE', 503, {
      provider: providerName,
      ...details,
    });
    this.name = 'ProviderUnavailableException';
  }
}
