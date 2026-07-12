import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { PricingService } from '../pricing.service';
import { SalesOrdersController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService, PricingService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
