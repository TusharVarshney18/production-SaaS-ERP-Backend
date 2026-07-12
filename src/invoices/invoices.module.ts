import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { PricingService } from '../sales/pricing.service';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PricingService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
