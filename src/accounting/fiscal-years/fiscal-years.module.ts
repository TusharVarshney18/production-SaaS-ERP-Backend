import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { AuditLogModule } from '../../audit-log/audit-log.module';
import { FiscalYearsController } from './fiscal-years.controller';
import { FiscalYearsService } from './fiscal-years.service';

@Module({
  imports: [AuthorizationModule, AuditLogModule],
  controllers: [FiscalYearsController],
  providers: [FiscalYearsService],
  exports: [FiscalYearsService],
})
export class FiscalYearsModule {}
