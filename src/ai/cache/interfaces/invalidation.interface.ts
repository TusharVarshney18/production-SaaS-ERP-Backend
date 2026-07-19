export interface InvalidationEvent {
  type:
    | 'manual'
    | 'ttl'
    | 'knowledge_update'
    | 'document_reindex'
    | 'conversation_reset'
    | 'organization_clear';
  category?: string;
  key?: string;
  organizationId: string;
  tags?: string[];
  timestamp: string;
}

export interface ICacheInvalidationService {
  invalidate(event: InvalidationEvent): Promise<number>;
  invalidateByCategory(category: string, organizationId: string): Promise<number>;
  invalidateByKey(key: string, organizationId: string): Promise<boolean>;
  invalidateByTags(tags: string[], organizationId: string): Promise<number>;
  invalidateAll(organizationId: string): Promise<number>;
  registerHandler(eventType: string, handler: (event: InvalidationEvent) => Promise<void>): void;
}
