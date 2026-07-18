export interface AuthCredentials {
  type: 'api-key' | 'bearer' | 'oauth2' | 'jwt' | 'mtls';
  value: string;
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  authenticated: boolean;
  token?: string;
  expiresAt?: number;
  identity?: Record<string, unknown>;
  error?: string;
}

export interface IMCPAuthProvider {
  readonly name: string;
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  validate(token: string): Promise<AuthResult>;
  refresh(token: string): Promise<AuthResult>;
  revoke(token: string): Promise<boolean>;
}
