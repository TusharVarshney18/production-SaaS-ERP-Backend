export class SaveMemoryDto {
  organizationId: string;
  userId?: string;
  type: string;
  key: string;
  value: unknown;
  scope: 'organization' | 'user';
  tags?: string[];
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export class MemoryResponseDto {
  id: string;
  organizationId: string;
  key: string;
  value: unknown;
  type: string;
  scope: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
