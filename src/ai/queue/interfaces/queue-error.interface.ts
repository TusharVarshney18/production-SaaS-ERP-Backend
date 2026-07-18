export enum QueueErrorCode {
  QUEUE_FULL = 'QUEUE_FULL',
  JOB_NOT_FOUND = 'JOB_NOT_FOUND',
  WORKER_NOT_FOUND = 'WORKER_NOT_FOUND',
  WORKER_BUSY = 'WORKER_BUSY',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  QUEUE_PAUSED = 'QUEUE_PAUSED',
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',
  TIMEOUT = 'QUEUE_TIMEOUT',
}

export class QueueError extends Error {
  constructor(
    message: string,
    public readonly code: QueueErrorCode = QueueErrorCode.PROCESSING_FAILED,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'QueueError';
  }
}
