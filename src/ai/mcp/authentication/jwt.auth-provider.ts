import { Injectable, Logger } from '@nestjs/common';
import { IMCPAuthProvider, AuthCredentials, AuthResult } from '../interfaces/auth-provider.interface';
import { MCPError, MCPErrorCode } from '../interfaces/mcp-error.interface';

@Injectable()
export class JwtAuthProvider implements IMCPAuthProvider {
  readonly name = 'jwt';
  private readonly logger = new Logger(JwtAuthProvider.name);
  private secret = '';
  private readonly revokedTokens = new Set<string>();

  setSecret(secret: string): void {
    this.secret = secret;
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    return this.validate(credentials.value);
  }

  async validate(token: string): Promise<AuthResult> {
    if (this.revokedTokens.has(token)) {
      return { authenticated: false, error: 'Token has been revoked' };
    }
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return { authenticated: false, error: 'Invalid JWT format' };
      }
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (payload.exp && Date.now() / 1000 > payload.exp) {
        return { authenticated: false, error: 'JWT expired' };
      }
      return {
        authenticated: true,
        token,
        identity: payload,
      };
    } catch {
      return { authenticated: false, error: 'Invalid JWT' };
    }
  }

  async refresh(_token: string): Promise<AuthResult> {
    return { authenticated: false, error: 'JWT refresh not supported' };
  }

  async revoke(token: string): Promise<boolean> {
    this.revokedTokens.add(token);
    return true;
  }
}
