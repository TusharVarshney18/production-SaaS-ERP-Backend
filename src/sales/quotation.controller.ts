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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { QuotationService } from './quotation.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { CancelQuotationDto, RejectQuotationDto } from './dto/quotation-status.dto';

@ApiTags('Sales - Quotations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/organizations/:orgId')
export class QuotationController {
  constructor(private readonly quotations: QuotationService) {}

  // ─── Quotation CRUD ────────────────────────

  @Post('quotations')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:create')
  @ApiOperation({ summary: 'Create a new quotation' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateQuotationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.create(orgId, dto, user.sub, req.requestId);
  }

  @Get('quotations')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:read')
  @ApiOperation({ summary: 'List quotations with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: QuotationQueryDto) {
    return this.quotations.findAll(orgId, query);
  }

  @Get('quotations/:id')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:read')
  @ApiOperation({ summary: 'Get quotation details with items and timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.quotations.findOne(orgId, id);
  }

  @Patch('quotations/:id')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Update quotation' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateQuotationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('quotations/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Archive quotation' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.archive(orgId, id, user.sub, req.requestId);
  }

  @Post('quotations/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Restore archived quotation' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete('quotations/:id')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:delete')
  @ApiOperation({ summary: 'Soft delete quotation' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.delete(orgId, id, user.sub, req.requestId);
  }

  // ─── Status Transitions ────────────────────

  @Post('quotations/:id/send')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:send')
  @ApiOperation({ summary: 'Send quotation to customer' })
  send(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.send(orgId, id, user.sub, req.requestId);
  }

  @Post('quotations/:id/accept')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:accept')
  @ApiOperation({ summary: 'Accept quotation' })
  accept(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.accept(orgId, id, user.sub, req.requestId);
  }

  @Post('quotations/:id/reject')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:reject')
  @ApiOperation({ summary: 'Reject quotation' })
  reject(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.reject(orgId, id, user.sub, req.requestId, dto.reason);
  }

  @Post('quotations/:id/cancel')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:cancel')
  @ApiOperation({ summary: 'Cancel quotation' })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CancelQuotationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.cancel(orgId, id, user.sub, req.requestId, dto.reason);
  }

  @Post('quotations/:id/duplicate')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:create')
  @ApiOperation({ summary: 'Duplicate quotation' })
  duplicate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.duplicate(orgId, id, user.sub, req.requestId);
  }

  // ─── Items ─────────────────────────────────

  @Post('quotations/:id/items')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Add item to quotation' })
  addItem(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateQuotationItemDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.addItem(orgId, id, dto, user.sub, req.requestId);
  }

  @Patch('quotations/:id/items/:itemId')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Update quotation item' })
  updateItem(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateQuotationItemDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.updateItem(orgId, id, itemId, dto, user.sub, req.requestId);
  }

  @Delete('quotations/:id/items/:itemId')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Delete quotation item' })
  deleteItem(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.deleteItem(orgId, id, itemId, user.sub, req.requestId);
  }

  @Post('quotations/:id/items/reorder')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:update')
  @ApiOperation({ summary: 'Reorder quotation items' })
  reorderItems(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ReorderItemsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.quotations.reorderItems(orgId, id, dto, user.sub, req.requestId);
  }

  // ─── Timeline ──────────────────────────────

  @Get('quotations/:id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('quotation:read')
  @ApiOperation({ summary: 'Get quotation timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.quotations.getTimeline(orgId, id, page, limit);
  }
}
