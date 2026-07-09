import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionLifecycleService } from './subscription-lifecycle.service';
import { PlanResolver } from './plan-resolver.service';
import { FeatureResolver } from './feature-resolver.service';
import { UsageResolver } from './usage-resolver.service';
import { EntitlementService } from './entitlement.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionService,
    SubscriptionLifecycleService,
    PlanResolver,
    FeatureResolver,
    UsageResolver,
    EntitlementService,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionService,
    SubscriptionLifecycleService,
    PlanResolver,
    FeatureResolver,
    UsageResolver,
    EntitlementService,
  ],
})
export class SubscriptionsModule {}
