import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Accounting - Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/organizations/:orgId/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('general-ledger')
  @UseGuards(PermissionGuard)
  @Permissions('accounting_report:read')
  @ApiOperation({ summary: 'General ledger with filters' })
  getGeneralLedger(
    @Param('orgId') orgId: string,
    @Query('accountId') accountId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.reports.getGeneralLedger(orgId, accountId, dateFrom, dateTo, page, limit);
  }

  @Get('trial-balance')
  @UseGuards(PermissionGuard)
  @Permissions('accounting_report:read')
  @ApiOperation({ summary: 'Trial balance as of date' })
  getTrialBalance(@Param('orgId') orgId: string, @Query('asOfDate') asOfDate?: string) {
    return this.reports.getTrialBalance(orgId, asOfDate);
  }

  @Get('balance-sheet')
  @UseGuards(PermissionGuard)
  @Permissions('accounting_report:read')
  @ApiOperation({ summary: 'Balance sheet as of date' })
  getBalanceSheet(@Param('orgId') orgId: string, @Query('asOfDate') asOfDate?: string) {
    return this.reports.getBalanceSheet(orgId, asOfDate);
  }

  @Get('profit-loss')
  @UseGuards(PermissionGuard)
  @Permissions('accounting_report:read')
  @ApiOperation({ summary: 'Profit & loss statement for date range' })
  getProfitAndLoss(
    @Param('orgId') orgId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reports.getProfitAndLoss(orgId, dateFrom, dateTo);
  }
}
