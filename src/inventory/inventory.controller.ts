import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { InventoryService } from './inventory.service';

@ApiTags('Inventory - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/organizations/:orgId')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('dashboard')
  @UseGuards(PermissionGuard)
  @Permissions('inventory:dashboard')
  @ApiOperation({ summary: 'Get inventory dashboard summary' })
  dashboard(@Param('orgId') orgId: string) {
    return this.inventory.getDashboard(orgId);
  }

  @Get('search')
  @UseGuards(PermissionGuard)
  @Permissions('inventory:search')
  @ApiOperation({ summary: 'Search inventory by product, SKU, or warehouse' })
  search(
    @Param('orgId') orgId: string,
    @Query('q') q: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.inventory.search(orgId, q, warehouseId);
  }
}
