import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { GoodsReceiptService } from './goods-receipt.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { GoodsReceiptQueryDto } from './dto/goods-receipt-query.dto';

@ApiTags('Procurement - Goods Receipt')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/organizations/:orgId/goods-receipts')
export class GoodsReceiptController {
  constructor(private readonly goodsReceipt: GoodsReceiptService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('goods_receipt:create')
  @ApiOperation({ summary: 'Receive goods against a purchase order (creates stock + ledger)' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.goodsReceipt.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('goods_receipt:read')
  @ApiOperation({ summary: 'List goods receipts with filters and pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: GoodsReceiptQueryDto) {
    return this.goodsReceipt.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('goods_receipt:read')
  @ApiOperation({ summary: 'Get goods receipt details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.goodsReceipt.findOne(orgId, id);
  }

  @Post(':id/cancel')
  @UseGuards(PermissionGuard)
  @Permissions('goods_receipt:cancel')
  @ApiOperation({ summary: 'Cancel a draft goods receipt' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.goodsReceipt.cancel(orgId, id, reason || null, user.sub, req.requestId);
  }
}
