export interface JwtPayload {
  sub: string;
  org: string;
  email: string;
  roleVersion: number;
  sessionId: string;
  iat?: number;
  exp?: number;
}
