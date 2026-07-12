import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { ChartOfAccountsService } from './chart-of-accounts.service';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';
import { ChartOfAccountQueryDto } from './dto/chart-of-account-query.dto';

@ApiTags('Accounting - Chart of Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/organizations/:orgId/chart-of-accounts')
export class ChartOfAccountsController {
  constructor(private readonly coa: ChartOfAccountsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('chart_of_account:create')
  @ApiOperation({ summary: 'Create a new account' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateChartOfAccountDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.coa.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('chart_of_account:read')
  @ApiOperation({ summary: 'List accounts with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: ChartOfAccountQueryDto) {
    return this.coa.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('chart_of_account:read')
  @ApiOperation({ summary: 'Get account details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.coa.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('chart_of_account:update')
  @ApiOperation({ summary: 'Update account' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateChartOfAccountDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.coa.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('chart_of_account:delete')
  @ApiOperation({ summary: 'Delete or deactivate account' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.coa.delete(orgId, id, user.sub, req.requestId);
  }

  @Get(':id/balance')
  @UseGuards(PermissionGuard)
  @Permissions('chart_of_account:read')
  @ApiOperation({ summary: 'Get account balance' })
  getBalance(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.coa.getAccountBalance(orgId, id);
  }
}
