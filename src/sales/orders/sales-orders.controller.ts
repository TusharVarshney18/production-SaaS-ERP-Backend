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
import { SalesOrderStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SalesOrdersService } from './sales-orders.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';
import { CancelSalesOrderDto } from './dto/sales-order-status.dto';

@ApiTags('Sales - Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/organizations/:orgId')
export class SalesOrdersController {
  constructor(private readonly orders: SalesOrdersService) {}

  // ─── CRUD ──────────────────────────────────

  @Post('orders')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:create')
  @ApiOperation({ summary: 'Create a new sales order' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateSalesOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.create(orgId, dto, user.sub, req.requestId);
  }

  @Post('orders/from-quotation/:quotationId')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:create')
  @ApiOperation({ summary: 'Convert an accepted quotation to a sales order' })
  convertFromQuotation(
    @Param('orgId') orgId: string,
    @Param('quotationId') quotationId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.convertFromQuotation(orgId, quotationId, user.sub, req.requestId);
  }

  @Get('orders')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:read')
  @ApiOperation({ summary: 'List sales orders with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: SalesOrderQueryDto) {
    return this.orders.findAll(orgId, query);
  }

  @Get('orders/:id')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:read')
  @ApiOperation({ summary: 'Get sales order details with items and timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.orders.findOne(orgId, id);
  }

  @Patch('orders/:id')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:update')
  @ApiOperation({ summary: 'Update draft sales order' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.update(orgId, id, dto, user.sub, req.requestId);
  }

  // ─── Status Transitions ────────────────────

  @Post('orders/:id/confirm')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:confirm')
  @ApiOperation({ summary: 'Confirm draft sales order' })
  confirm(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.confirm(orgId, id, user.sub, req.requestId);
  }

  @Post('orders/:id/cancel')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:cancel')
  @ApiOperation({ summary: 'Cancel sales order' })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CancelSalesOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.cancel(orgId, id, user.sub, req.requestId, dto.reason);
  }

  @Post('orders/:id/status')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:update')
  @ApiOperation({ summary: 'Change sales order status' })
  changeStatus(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('status') status: SalesOrderStatus,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.changeStatus(orgId, id, status, user.sub, req.requestId);
  }

  // ─── Duplicate ─────────────────────────────

  @Post('orders/:id/duplicate')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:create')
  @ApiOperation({ summary: 'Duplicate sales order' })
  duplicate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.duplicate(orgId, id, user.sub, req.requestId);
  }

  // ─── Archive / Restore / Delete ────────────

  @Post('orders/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:update')
  @ApiOperation({ summary: 'Archive sales order' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.archive(orgId, id, user.sub, req.requestId);
  }

  @Post('orders/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:update')
  @ApiOperation({ summary: 'Restore archived sales order' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete('orders/:id')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:delete')
  @ApiOperation({ summary: 'Soft delete sales order' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.orders.delete(orgId, id, user.sub, req.requestId);
  }

  // ─── Timeline ──────────────────────────────

  @Get('orders/:id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('sales_order:read')
  @ApiOperation({ summary: 'Get sales order timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.orders.getTimeline(orgId, id, page, limit);
  }
}
