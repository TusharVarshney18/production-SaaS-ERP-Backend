import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ChartOfAccountsModule } from './chart-of-accounts/chart-of-accounts.module';
import { FiscalYearsModule } from './fiscal-years/fiscal-years.module';
import { JournalEntriesModule } from './journal-entries/journal-entries.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    AuthorizationModule,
    AuditLogModule,
    ChartOfAccountsModule,
    FiscalYearsModule,
    JournalEntriesModule,
    ReportsModule,
  ],
})
export class AccountingModule {}
