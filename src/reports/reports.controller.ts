import { Controller, Get, Post, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { DashboardService } from './services/dashboard.service';
import { SalesReportsService } from './services/sales-reports.service';
import { InventoryReportsService } from './services/inventory-reports.service';
import { ProcurementReportsService } from './services/procurement-reports.service';
import { FinanceReportsService } from './services/finance-reports.service';
import { HrReportsService } from './services/hr-reports.service';
import { ExportService } from './services/export.service';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports/organizations/:orgId')
export class ReportsController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly sales: SalesReportsService,
    private readonly inventory: InventoryReportsService,
    private readonly procurement: ProcurementReportsService,
    private readonly finance: FinanceReportsService,
    private readonly hr: HrReportsService,
    private readonly exportService: ExportService,
  ) {}

  // ─── Dashboards ──────────────────────────

  @Get('dashboard/executive')
  @UseGuards(PermissionGuard)
  @Permissions('report:dashboard')
  @ApiOperation({ summary: 'Executive dashboard with KPIs and charts' })
  getExecutiveDashboard(@Param('orgId') orgId: string) {
    return this.dashboard.getExecutiveDashboard(orgId);
  }

  @Get('dashboard/sales')
  @UseGuards(PermissionGuard)
  @Permissions('report:dashboard')
  @ApiOperation({ summary: 'Sales dashboard' })
  getSalesDashboard(@Param('orgId') orgId: string) {
    return this.dashboard.getSalesDashboard(orgId);
  }

  @Get('dashboard/inventory')
  @UseGuards(PermissionGuard)
  @Permissions('report:dashboard')
  @ApiOperation({ summary: 'Inventory dashboard' })
  getInventoryDashboard(@Param('orgId') orgId: string) {
    return this.dashboard.getInventoryDashboard(orgId);
  }

  @Get('dashboard/procurement')
  @UseGuards(PermissionGuard)
  @Permissions('report:dashboard')
  @ApiOperation({ summary: 'Procurement dashboard' })
  getProcurementDashboard(@Param('orgId') orgId: string) {
    return this.dashboard.getProcurementDashboard(orgId);
  }

  @Get('dashboard/accounting')
  @UseGuards(PermissionGuard)
  @Permissions('report:dashboard')
  @ApiOperation({ summary: 'Accounting dashboard' })
  getAccountingDashboard(@Param('orgId') orgId: string) {
    return this.dashboard.getAccountingDashboard(orgId);
  }

  @Get('dashboard/hr')
  @UseGuards(PermissionGuard)
  @Permissions('report:dashboard')
  @ApiOperation({ summary: 'HR dashboard' })
  getHrDashboard(@Param('orgId') orgId: string) {
    return this.dashboard.getHrDashboard(orgId);
  }

  // ─── Sales Reports ───────────────────────

  @Get('sales')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Sales order report' })
  getSalesReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.sales.getSalesReport(orgId, query);
  }

  @Get('quotations')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Quotation report' })
  getQuotationReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.sales.getQuotationReport(orgId, query);
  }

  @Get('customers')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Customer report' })
  getCustomerReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.sales.getCustomerReport(orgId, query);
  }

  @Get('sales/top-products')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Top selling products' })
  getTopProducts(
    @Param('orgId') orgId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.sales.getTopProducts(orgId, dateFrom, dateTo);
  }

  // ─── Inventory Reports ───────────────────

  @Get('inventory')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Inventory stock report' })
  getInventoryReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.inventory.getInventoryReport(orgId, query);
  }

  @Get('inventory/stock-movement')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Stock movement / ledger report' })
  getStockMovementReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.inventory.getStockMovementReport(orgId, query);
  }

  @Get('inventory/warehouses')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Warehouse stock summary' })
  getWarehouseReport(@Param('orgId') orgId: string) {
    return this.inventory.getWarehouseReport(orgId);
  }

  @Get('inventory/top-moving')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Top moving products (30 days)' })
  getTopMovingProducts(@Param('orgId') orgId: string) {
    return this.inventory.getTopMovingProducts(orgId);
  }

  // ─── Procurement Reports ─────────────────

  @Get('purchases')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Purchase order report' })
  getPurchaseReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.procurement.getPurchaseReport(orgId, query);
  }

  @Get('vendors')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Vendor report' })
  getVendorReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.procurement.getVendorReport(orgId, query);
  }

  // ─── Finance Reports ─────────────────────

  @Get('journals')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Journal entry report' })
  getJournalReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.finance.getJournalReport(orgId, query);
  }

  @Get('general-ledger')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'General ledger report' })
  getGeneralLedgerReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.finance.getGeneralLedgerReport(orgId, query);
  }

  @Get('trial-balance')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Trial balance' })
  getTrialBalance(@Param('orgId') orgId: string, @Query('asOfDate') asOfDate?: string) {
    return this.finance.getTrialBalance(orgId, asOfDate);
  }

  @Get('profit-loss')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Profit & loss statement' })
  getProfitAndLoss(
    @Param('orgId') orgId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.finance.getProfitAndLoss(orgId, dateFrom, dateTo);
  }

  @Get('balance-sheet')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Balance sheet' })
  getBalanceSheet(@Param('orgId') orgId: string, @Query('asOfDate') asOfDate?: string) {
    return this.finance.getBalanceSheet(orgId, asOfDate);
  }

  // ─── HR Reports ──────────────────────────

  @Get('employees')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Employee report' })
  getEmployeeReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.hr.getEmployeeReport(orgId, query);
  }

  @Get('attendance')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Attendance report' })
  getAttendanceReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.hr.getAttendanceReport(orgId, query);
  }

  @Get('leave')
  @UseGuards(PermissionGuard)
  @Permissions('report:read')
  @ApiOperation({ summary: 'Leave report' })
  getLeaveReport(@Param('orgId') orgId: string, @Query() query: ReportQueryDto) {
    return this.hr.getLeaveReport(orgId, query);
  }

  // ─── Exports ─────────────────────────────

  @Post('export/csv')
  @UseGuards(PermissionGuard)
  @Permissions('report:export')
  @ApiOperation({ summary: 'Export report data as CSV' })
  exportCsv(
    @Param('orgId') _orgId: string,
    @Query('format') _format: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
    res.send(this.exportService.toCsv([]));
  }

  @Post('export/excel')
  @UseGuards(PermissionGuard)
  @Permissions('report:export')
  @ApiOperation({ summary: 'Export report data as Excel XML' })
  exportExcel(
    @Param('orgId') _orgId: string,
    @Query('format') _format: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'application/vnd.ms-excel');
    res.setHeader('Content-Disposition', 'attachment; filename=report.xls');
    res.send(this.exportService.toExcelXml([], 'Report'));
  }
}
