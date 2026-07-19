import { Injectable, Logger } from '@nestjs/common';
import {
  IMCPAuthProvider,
  AuthCredentials,
  AuthResult,
} from '../interfaces/auth-provider.interface';

@Injectable()
export class BearerTokenAuthProvider implements IMCPAuthProvider {
  readonly name = 'bearer';
  private readonly logger = new Logger(BearerTokenAuthProvider.name);
  private readonly validTokens = new Map<
    string,
    { identity: Record<string, unknown>; expiresAt?: number }
  >();

  registerToken(token: string, identity: Record<string, unknown>, ttlMs?: number): void {
    this.validTokens.set(token, {
      identity,
      expiresAt: ttlMs ? Date.now() + ttlMs : undefined,
    });
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const entry = this.validTokens.get(credentials.value);
    if (!entry) {
      return { authenticated: false, error: 'Invalid bearer token' };
    }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.validTokens.delete(credentials.value);
      return { authenticated: false, error: 'Bearer token expired' };
    }
    return {
      authenticated: true,
      token: credentials.value,
      identity: entry.identity,
    };
  }

  async validate(token: string): Promise<AuthResult> {
    return this.authenticate({ type: 'bearer', value: token });
  }

  async refresh(token: string): Promise<AuthResult> {
    const entry = this.validTokens.get(token);
    if (!entry) {
      return { authenticated: false, error: 'Token not found' };
    }
    return {
      authenticated: true,
      token,
      identity: entry.identity,
    };
  }

  async revoke(token: string): Promise<boolean> {
    return this.validTokens.delete(token);
  }
}
