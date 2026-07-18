export enum MCPErrorCode {
  CONNECTION_FAILED = 'MCP_CONNECTION_FAILED',
  TIMEOUT = 'MCP_TIMEOUT',
  AUTH_FAILED = 'MCP_AUTH_FAILED',
  NOT_FOUND = 'MCP_NOT_FOUND',
  EXECUTION_FAILED = 'MCP_EXECUTION_FAILED',
  TRANSPORT_ERROR = 'MCP_TRANSPORT_ERROR',
  SESSION_EXPIRED = 'MCP_SESSION_EXPIRED',
  UNAUTHORIZED = 'MCP_UNAUTHORIZED',
  INVALID_REQUEST = 'MCP_INVALID_REQUEST',
  SERVER_ERROR = 'MCP_SERVER_ERROR',
}

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code: MCPErrorCode = MCPErrorCode.SERVER_ERROR,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'MCPError';
  }
}
