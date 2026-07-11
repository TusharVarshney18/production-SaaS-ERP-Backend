import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { BillingPortalController } from './billing-portal.controller';
import { BillingPortalService } from './billing-portal.service';

@Module({
  imports: [BillingModule, SubscriptionsModule, AuditLogModule, OrganizationsModule],
  controllers: [BillingPortalController],
  providers: [BillingPortalService],
})
export class BillingPortalModule {}
