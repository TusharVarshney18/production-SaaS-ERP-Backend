import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PaymentGateway } from './payment-gateway.interface';

@Injectable()
export class PaymentProviderFactory {
  private readonly logger = new Logger(PaymentProviderFactory.name);
  private readonly providers = new Map<string, PaymentGateway>();

  register(name: string, provider: PaymentGateway): void {
    if (this.providers.has(name)) {
      this.logger.warn(`Provider "${name}" is already registered. Overwriting.`);
    }
    this.providers.set(name, provider);
    this.logger.log(`Payment gateway registered: ${name}`);
  }

  getProvider(name: string): PaymentGateway {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotImplementedException(
        `Payment gateway "${name}" is not registered. Available: [${this.getRegisteredProviders().join(', ') || 'none'}]`,
      );
    }
    return provider;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }

  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }
}
