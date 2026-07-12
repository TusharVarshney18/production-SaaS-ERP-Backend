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
import { WarehouseService } from './warehouse.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';

@ApiTags('Inventory - Warehouses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/organizations/:orgId/warehouses')
export class WarehouseController {
  constructor(private readonly warehouse: WarehouseService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:create')
  @ApiOperation({ summary: 'Create a new warehouse' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateWarehouseDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.warehouse.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:read')
  @ApiOperation({ summary: 'List warehouses with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: WarehouseQueryDto) {
    return this.warehouse.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:read')
  @ApiOperation({ summary: 'Get warehouse details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.warehouse.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:update')
  @ApiOperation({ summary: 'Update warehouse' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.warehouse.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:update')
  @ApiOperation({ summary: 'Archive warehouse (set inactive)' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.warehouse.archive(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:update')
  @ApiOperation({ summary: 'Restore warehouse (set active)' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.warehouse.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('warehouse:delete')
  @ApiOperation({ summary: 'Soft delete warehouse' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.warehouse.delete(orgId, id, user.sub, req.requestId);
  }
}
