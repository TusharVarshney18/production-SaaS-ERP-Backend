import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { FiscalYearsService } from './fiscal-years.service';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { UpdateFiscalYearDto } from './dto/update-fiscal-year.dto';

@ApiTags('Accounting - Fiscal Years')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/organizations/:orgId/fiscal-years')
export class FiscalYearsController {
  constructor(private readonly fiscalYears: FiscalYearsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('fiscal_year:create')
  @ApiOperation({ summary: 'Create a new fiscal year with optional periods' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateFiscalYearDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.fiscalYears.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('fiscal_year:read')
  @ApiOperation({ summary: 'List fiscal years' })
  findAll(@Param('orgId') orgId: string) {
    return this.fiscalYears.findAll(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('fiscal_year:read')
  @ApiOperation({ summary: 'Get fiscal year with periods' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.fiscalYears.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('fiscal_year:update')
  @ApiOperation({ summary: 'Update fiscal year' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFiscalYearDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.fiscalYears.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/close')
  @UseGuards(PermissionGuard)
  @Permissions('fiscal_year:close')
  @ApiOperation({ summary: 'Close fiscal year and all periods' })
  close(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.fiscalYears.close(orgId, id, user.sub, req.requestId);
  }
}
