import { AIException } from './ai.exception';

export class InvalidProviderException extends AIException {
  constructor(providerName: string, availableProviders: string[]) {
    super(
      `Provider "${providerName}" is not registered. Available: [${availableProviders.join(', ')}]`,
      'INVALID_PROVIDER',
      400,
      { provider: providerName, availableProviders },
    );
    this.name = 'InvalidProviderException';
  }
}
