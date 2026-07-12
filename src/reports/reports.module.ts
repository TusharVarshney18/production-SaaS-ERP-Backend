import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { DashboardService } from './services/dashboard.service';
import { SalesReportsService } from './services/sales-reports.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { ProcurementReportsService } from './services/procurement-reports.service';
import { FinanceReportsService } from './services/finance-reports.service';
import { HrReportsService } from './services/hr-reports.service';
import { ReportEngineService } from './services/report-engine.service';
import { ExportService } from './services/export.service';

@Module({
  imports: [AuthorizationModule, PrismaModule],
  controllers: [ReportsController],
  providers: [
    DashboardService,
    SalesReportsService,
    InventoryReportsService,
    ProcurementReportsService,
    FinanceReportsService,
    HrReportsService,
    ReportEngineService,
    ExportService,
  ],
  exports: [ReportEngineService, ExportService],
})
export class ReportsModule {}
