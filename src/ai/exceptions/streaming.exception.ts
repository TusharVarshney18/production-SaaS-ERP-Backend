import { AIException } from './ai.exception';

export class StreamingException extends AIException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message || 'Streaming error occurred', 'STREAMING_ERROR', 500, details);
    this.name = 'StreamingException';
  }
}
