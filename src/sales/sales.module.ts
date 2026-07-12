import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { QuotationController } from './quotation.controller';
import { QuotationService } from './quotation.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [QuotationController],
  providers: [QuotationService, PricingService],
  exports: [PricingService, QuotationService],
})
export class SalesModule {}
