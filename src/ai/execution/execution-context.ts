export interface ExecutionContext {
  organizationId: string;
  userId: string;
  requestId: string;
  correlationId?: string;
  role?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}
