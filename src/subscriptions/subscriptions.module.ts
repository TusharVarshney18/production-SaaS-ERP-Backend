import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { FeatureService } from './feature.service';
import { UsageService } from './usage.service';

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, FeatureService, UsageService],
  exports: [SubscriptionsService, FeatureService, UsageService],
})
export class SubscriptionsModule {}
