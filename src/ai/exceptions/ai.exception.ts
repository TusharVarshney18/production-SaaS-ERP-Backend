export class AIException extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AI_ERROR',
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AIException';
  }
}
