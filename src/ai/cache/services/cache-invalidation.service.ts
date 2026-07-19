import { Injectable, Logger } from '@nestjs/common';
import { ICacheInvalidationService, InvalidationEvent } from '../interfaces/invalidation.interface';
import { MemoryCacheProvider } from '../providers/memory-cache.provider';
import { CacheMetricsService } from './cache-metrics.service';
import { CachePolicyManager } from './cache-policy-manager.service';

@Injectable()
export class CacheInvalidationService implements ICacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);
  private readonly handlers = new Map<string, Set<(event: InvalidationEvent) => Promise<void>>>();

  constructor(
    private readonly provider: MemoryCacheProvider,
    private readonly metrics: CacheMetricsService,
    private readonly policyManager: CachePolicyManager,
  ) {}

  async invalidate(event: InvalidationEvent): Promise<number> {
    let count = 0;
    if (event.key) {
      await this.invalidateByKey(event.key, event.organizationId);
      count = 1;
    } else if (event.category) {
      count = await this.invalidateByCategory(event.category, event.organizationId);
    } else if (event.tags && event.tags.length > 0) {
      count = await this.invalidateByTags(event.tags, event.organizationId);
    } else {
      count = await this.invalidateAll(event.organizationId);
    }

    await this.dispatchHandlers(event);
    this.logger.debug(`Invalidation event processed: ${event.type} (${count} entries)`);
    return count;
  }

  async invalidateByCategory(category: string, organizationId: string): Promise<number> {
    const count = await this.provider.deleteByCategory(category, organizationId);
    if (count > 0) this.logger.log(`Invalidated ${count} cache entries for category ${category}`);
    return count;
  }

  async invalidateByKey(key: string, organizationId: string): Promise<boolean> {
    return this.provider.delete(key, organizationId);
  }

  async invalidateByTags(tags: string[], organizationId: string): Promise<number> {
    return this.provider.deleteByTags(tags, organizationId);
  }

  async invalidateAll(organizationId: string): Promise<number> {
    return this.provider.deleteByOrganization(organizationId);
  }

  registerHandler(eventType: string, handler: (event: InvalidationEvent) => Promise<void>): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  private async dispatchHandlers(event: InvalidationEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;
    await Promise.allSettled(
      [...handlers].map((h) =>
        h(event).catch((e) => this.logger.error(`Invalidation handler error: ${e.message}`)),
      ),
    );
  }
}
