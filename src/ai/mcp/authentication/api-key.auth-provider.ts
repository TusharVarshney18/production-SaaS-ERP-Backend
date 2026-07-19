import { Injectable, Logger } from '@nestjs/common';
import {
  IMCPAuthProvider,
  AuthCredentials,
  AuthResult,
} from '../interfaces/auth-provider.interface';

@Injectable()
export class ApiKeyAuthProvider implements IMCPAuthProvider {
  readonly name = 'api-key';
  private readonly logger = new Logger(ApiKeyAuthProvider.name);
  private readonly apiKeys = new Map<string, { key: string; identity: Record<string, unknown> }>();

  registerApiKey(key: string, identity: Record<string, unknown>): void {
    this.apiKeys.set(key, { key, identity });
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const entry = this.apiKeys.get(credentials.value);
    if (!entry) {
      return { authenticated: false, error: 'Invalid API key' };
    }
    return {
      authenticated: true,
      token: credentials.value,
      identity: entry.identity,
    };
  }

  async validate(token: string): Promise<AuthResult> {
    return this.authenticate({ type: 'api-key', value: token });
  }

  async refresh(_token: string): Promise<AuthResult> {
    return { authenticated: false, error: 'API keys cannot be refreshed' };
  }

  async revoke(token: string): Promise<boolean> {
    return this.apiKeys.delete(token);
  }

  removeApiKey(key: string): boolean {
    return this.apiKeys.delete(key);
  }

  getRegisteredKeys(): string[] {
    return [...this.apiKeys.keys()];
  }
}
