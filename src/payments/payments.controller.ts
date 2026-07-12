import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PaymentsService } from './payments.service';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { CaptureGatewayPaymentDto } from './dto/capture-gateway-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@ApiTags('Sales - Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales/organizations/:orgId')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments/manual')
  @UseGuards(PermissionGuard)
  @Permissions('payment:create')
  @ApiOperation({ summary: 'Create a manual payment against an invoice' })
  createManual(
    @Param('orgId') orgId: string,
    @Body() dto: CreateManualPaymentDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.payments.createManual(orgId, dto, user.sub, req.requestId);
  }

  @Post('payments/gateway')
  @UseGuards(PermissionGuard)
  @Permissions('payment:create')
  @ApiOperation({ summary: 'Capture a gateway payment against an invoice' })
  captureGateway(
    @Param('orgId') orgId: string,
    @Body() dto: CaptureGatewayPaymentDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.payments.captureGateway(orgId, dto, user.sub, req.requestId);
  }

  @Post('payments/:id/allocate')
  @UseGuards(PermissionGuard)
  @Permissions('payment:update')
  @ApiOperation({ summary: 'Allocate a payment to an invoice' })
  allocate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('invoiceId') invoiceId: string,
    @Body('amount') amount: number,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.payments.allocate(orgId, id, invoiceId, amount, user.sub, req.requestId);
  }

  @Post('payments/refund')
  @UseGuards(PermissionGuard)
  @Permissions('payment:refund')
  @ApiOperation({ summary: 'Refund a payment' })
  refund(
    @Param('orgId') orgId: string,
    @Body() dto: RefundPaymentDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.payments.refund(orgId, dto, user.sub, req.requestId);
  }

  @Get('payments')
  @UseGuards(PermissionGuard)
  @Permissions('payment:read')
  @ApiOperation({ summary: 'List payments with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: PaymentQueryDto) {
    return this.payments.findAll(orgId, query);
  }

  @Get('payments/:id')
  @UseGuards(PermissionGuard)
  @Permissions('payment:read')
  @ApiOperation({ summary: 'Get payment details with allocations' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.payments.findOne(orgId, id);
  }

  @Get('invoices/:invoiceId/payments')
  @UseGuards(PermissionGuard)
  @Permissions('payment:read')
  @ApiOperation({ summary: 'Get all payments for an invoice' })
  findByInvoice(@Param('orgId') orgId: string, @Param('invoiceId') invoiceId: string) {
    return this.payments.findByInvoice(orgId, invoiceId);
  }
}
