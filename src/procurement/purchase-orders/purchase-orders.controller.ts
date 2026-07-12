import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';

@ApiTags('Procurement - Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/organizations/:orgId/purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:create')
  @ApiOperation({ summary: 'Create a new purchase order' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.purchaseOrders.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:read')
  @ApiOperation({ summary: 'List purchase orders with filters and pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: PurchaseOrderQueryDto) {
    return this.purchaseOrders.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:read')
  @ApiOperation({ summary: 'Get purchase order details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.purchaseOrders.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:update')
  @ApiOperation({ summary: 'Update draft purchase order' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.purchaseOrders.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:approve')
  @ApiOperation({ summary: 'Approve purchase order' })
  approve(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.purchaseOrders.approve(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/cancel')
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:cancel')
  @ApiOperation({ summary: 'Cancel purchase order' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.purchaseOrders.cancel(orgId, id, reason || null, user.sub, req.requestId);
  }

  @Post(':id/duplicate')
  @UseGuards(PermissionGuard)
  @Permissions('purchase_order:create')
  @ApiOperation({ summary: 'Duplicate purchase order as new draft' })
  duplicate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.purchaseOrders.duplicate(orgId, id, user.sub, req.requestId);
  }
}
