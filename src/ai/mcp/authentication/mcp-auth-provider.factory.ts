import { Injectable, Logger } from '@nestjs/common';
import { IMCPAuthProvider } from '../interfaces/auth-provider.interface';
import { ApiKeyAuthProvider } from './api-key.auth-provider';
import { BearerTokenAuthProvider } from './bearer-token.auth-provider';
import { JwtAuthProvider } from './jwt.auth-provider';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

export type AuthProviderType = 'api-key' | 'bearer' | 'jwt';

@Injectable()
export class MCPAuthProviderFactory {
  private readonly logger = new Logger(MCPAuthProviderFactory.name);
  private readonly providers = new Map<string, IMCPAuthProvider>();

  constructor(
    private readonly apiKeyProvider: ApiKeyAuthProvider,
    private readonly bearerProvider: BearerTokenAuthProvider,
    private readonly jwtProvider: JwtAuthProvider,
  ) {
    this.registerProvider(apiKeyProvider);
    this.registerProvider(bearerProvider);
    this.registerProvider(jwtProvider);
  }

  registerProvider(provider: IMCPAuthProvider): void {
    this.providers.set(provider.name, provider);
    this.logger.log(`MCP auth provider registered: ${provider.name}`);
  }

  getProvider(name: string): IMCPAuthProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new MCPError(
        `Auth provider "${name}" not found`,
        MCPErrorCode.NOT_FOUND,
      );
    }
    return provider;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }
}
