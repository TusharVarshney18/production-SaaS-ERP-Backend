import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { PlanResolver } from './plan-resolver.service';
import { FeatureResolver } from './feature-resolver.service';
import { UsageResolver } from './usage-resolver.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    public readonly lifecycle: SubscriptionLifecycleService,
    public readonly plan: PlanResolver,
    public readonly features: FeatureResolver,
    public readonly usage: UsageResolver,
  ) {
    this.logger.log('SubscriptionService initialized');
  }

  async getCurrentSubscription(organizationId: string) {
    return this.plan.resolveActivePlan(organizationId);
  }

  async activateSubscription(organizationId: string) {
    return this.lifecycle.activate(organizationId);
  }

  async cancelSubscription(organizationId: string) {
    return this.lifecycle.cancel(organizationId);
  }

  async renewSubscription(organizationId: string) {
    return this.lifecycle.renew(organizationId);
  }

  async suspendSubscription(organizationId: string) {
    return this.lifecycle.suspend(organizationId);
  }
}
