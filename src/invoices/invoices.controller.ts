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
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { VoidInvoiceDto } from './dto/invoice-status.dto';

@ApiTags('Sales - Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/organizations/:orgId')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  // ─── CRUD ──────────────────────────────────

  @Post('invoices')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:create')
  @ApiOperation({ summary: 'Create a new invoice' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateInvoiceDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.create(orgId, dto, user.sub, req.requestId);
  }

  @Post('invoices/from-order/:salesOrderId')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:create')
  @ApiOperation({ summary: 'Generate invoice from a fulfilled sales order' })
  createFromSalesOrder(
    @Param('orgId') orgId: string,
    @Param('salesOrderId') salesOrderId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.createFromSalesOrder(orgId, salesOrderId, user.sub, req.requestId);
  }

  @Get('invoices')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:read')
  @ApiOperation({ summary: 'List invoices with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: InvoiceQueryDto) {
    return this.invoices.findAll(orgId, query);
  }

  @Get('invoices/:id')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:read')
  @ApiOperation({ summary: 'Get invoice details with items and timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.invoices.findOne(orgId, id);
  }

  @Patch('invoices/:id')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:update')
  @ApiOperation({ summary: 'Update draft invoice' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.update(orgId, id, dto, user.sub, req.requestId);
  }

  // ─── Status Transitions ────────────────────

  @Post('invoices/:id/send')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:send')
  @ApiOperation({ summary: 'Send invoice to customer' })
  send(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.send(orgId, id, user.sub, req.requestId);
  }

  @Post('invoices/:id/void')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:void')
  @ApiOperation({ summary: 'Void invoice' })
  void(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: VoidInvoiceDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.void(orgId, id, user.sub, req.requestId, dto.reason);
  }

  // ─── Duplicate ─────────────────────────────

  @Post('invoices/:id/duplicate')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:create')
  @ApiOperation({ summary: 'Duplicate invoice' })
  duplicate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.duplicate(orgId, id, user.sub, req.requestId);
  }

  // ─── Archive / Restore / Delete ────────────

  @Post('invoices/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:update')
  @ApiOperation({ summary: 'Archive invoice' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.archive(orgId, id, user.sub, req.requestId);
  }

  @Post('invoices/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:update')
  @ApiOperation({ summary: 'Restore archived invoice' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete('invoices/:id')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:delete')
  @ApiOperation({ summary: 'Soft delete invoice' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.invoices.delete(orgId, id, user.sub, req.requestId);
  }

  // ─── Timeline ──────────────────────────────

  @Get('invoices/:id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('invoice:read')
  @ApiOperation({ summary: 'Get invoice timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.invoices.getTimeline(orgId, id, page, limit);
  }
}
