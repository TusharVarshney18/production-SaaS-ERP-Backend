import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { ProcurementService } from './procurement.service';

@ApiTags('Procurement - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/organizations/:orgId')
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get('dashboard')
  @UseGuards(PermissionGuard)
  @Permissions('procurement:dashboard')
  @ApiOperation({ summary: 'Get procurement dashboard summary' })
  dashboard(@Param('orgId') orgId: string) {
    return this.procurement.getDashboard(orgId);
  }

  @Get('search')
  @UseGuards(PermissionGuard)
  @Permissions('procurement:search')
  @ApiOperation({ summary: 'Search vendors, POs, and GRNs' })
  search(@Param('orgId') orgId: string, @Query('q') q: string) {
    return this.procurement.search(orgId, q);
  }
}
