import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { StockService } from './stock.service';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockQueryDto } from './dto/stock-query.dto';

@ApiTags('Inventory - Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/organizations/:orgId/stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('stock:read')
  @ApiOperation({ summary: 'List stock with filters and pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: StockQueryDto) {
    return this.stock.findAll(orgId, query);
  }

  @Get('ledger')
  @UseGuards(PermissionGuard)
  @Permissions('stock:read')
  @ApiOperation({ summary: 'Get stock ledger entries' })
  getLedger(
    @Param('orgId') orgId: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.stock.getStockLedger(orgId, warehouseId, productId, page, limit);
  }

  @Get(':warehouseId/:productId')
  @UseGuards(PermissionGuard)
  @Permissions('stock:read')
  @ApiOperation({ summary: 'Get current stock for a product in a warehouse' })
  getStock(
    @Param('orgId') orgId: string,
    @Param('warehouseId') warehouseId: string,
    @Param('productId') productId: string,
  ) {
    return this.stock.getStock(orgId, warehouseId, productId);
  }

  @Post('reserve')
  @UseGuards(PermissionGuard)
  @Permissions('stock:reserve')
  @ApiOperation({ summary: 'Reserve stock for an order' })
  reserve(
    @Param('orgId') orgId: string,
    @Body() dto: ReserveStockDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.stock.reserve(orgId, dto, user.sub, req.requestId);
  }

  @Post('release')
  @UseGuards(PermissionGuard)
  @Permissions('stock:release')
  @ApiOperation({ summary: 'Release reserved stock' })
  release(
    @Param('orgId') orgId: string,
    @Body() dto: ReleaseStockDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.stock.release(orgId, dto, user.sub, req.requestId);
  }

  @Post('adjust')
  @UseGuards(PermissionGuard)
  @Permissions('stock:adjust')
  @ApiOperation({ summary: 'Adjust stock quantity' })
  adjust(
    @Param('orgId') orgId: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.stock.adjust(orgId, dto, user.sub, req.requestId);
  }
}
