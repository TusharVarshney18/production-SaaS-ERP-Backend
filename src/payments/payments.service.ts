import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  Prisma,
  SalesPaymentStatus,
  InvoicePaymentStatus,
  SalesInvoiceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import { CaptureGatewayPaymentDto } from './dto/capture-gateway-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  // ─── Private Helpers ───────────────────────

  private async recordTimeline(
    invoiceId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.salesInvoiceTimeline.create({
      data: {
        invoiceId,
        event,
        description,
        details: details as Prisma.InputJsonValue,
        userId: userId || null,
      },
    });
  }

  private async log(
    orgId: string,
    actorId: string,
    event: string,
    action: string,
    resourceId: string,
    details: Record<string, unknown>,
    requestId: string,
  ) {
    await this.auditLog.create({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      event,
      resource: 'sales_payment',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async findPaymentOrThrow(orgId: string, id: string) {
    const payment = await this.prisma.salesPayment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
        allocations: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private async updateInvoicePaymentStatus(invoiceId: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        payments: {
          where: { status: { not: SalesPaymentStatus.REFUNDED } },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const totalPaid = invoice.payments.reduce(
      (sum, p) => (p.status === SalesPaymentStatus.CAPTURED ? sum + p.amount : sum),
      0,
    );
    const newBalanceDue = Math.max(0, invoice.grandTotal - totalPaid);

    let paymentStatus: InvoicePaymentStatus;
    let invoiceStatus: SalesInvoiceStatus;

    if (totalPaid >= invoice.grandTotal) {
      paymentStatus = InvoicePaymentStatus.PAID;
      invoiceStatus = SalesInvoiceStatus.PAID;
    } else if (totalPaid > 0) {
      paymentStatus = InvoicePaymentStatus.PARTIALLY_PAID;
      invoiceStatus = SalesInvoiceStatus.PARTIALLY_PAID;
    } else {
      paymentStatus = InvoicePaymentStatus.UNPAID;
      invoiceStatus =
        invoice.status === SalesInvoiceStatus.VOID
          ? SalesInvoiceStatus.VOID
          : SalesInvoiceStatus.SENT;
    }

    await this.prisma.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        amountPaid: totalPaid,
        balanceDue: newBalanceDue,
        paymentStatus,
        status: invoiceStatus,
      },
    });

    return { totalPaid, balanceDue: newBalanceDue, paymentStatus, invoiceStatus };
  }

  // ─── Create Manual Payment ─────────────────

  async createManual(
    orgId: string,
    dto: CreateManualPaymentDto,
    userId: string,
    requestId: string,
  ) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: dto.invoiceId, organizationId: orgId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === SalesInvoiceStatus.VOID) {
      throw new BadRequestException('Cannot add payment to voided invoice');
    }

    const overpayment = invoice.amountPaid + dto.amount - invoice.grandTotal;
    if (overpayment > 0) {
      throw new BadRequestException(
        `Payment would overpay invoice by ${overpayment}. Allowed overpayment: 0.`,
      );
    }

    const payment = await this.prisma.salesPayment.create({
      data: {
        organizationId: orgId,
        invoiceId: dto.invoiceId,
        gateway: 'MANUAL',
        transactionId: dto.transactionId,
        amount: dto.amount,
        currency: dto.currency || invoice.currency,
        paymentMethod: dto.paymentMethod,
        status: SalesPaymentStatus.CAPTURED,
        paidAt: new Date(),
        metadata: dto.notes ? { notes: dto.notes } : Prisma.JsonNull,
      },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    await this.prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: dto.invoiceId,
        allocatedAmount: dto.amount,
      },
    });

    const paymentStatus = await this.updateInvoicePaymentStatus(dto.invoiceId);

    const eventType =
      paymentStatus.paymentStatus === InvoicePaymentStatus.PAID
        ? 'invoice.paid'
        : 'invoice.partially_paid';

    await this.recordTimeline(
      dto.invoiceId,
      'payment.created',
      `Manual payment of ${dto.amount} ${dto.currency || invoice.currency} received`,
      { paymentId: payment.id, amount: dto.amount, transactionId: dto.transactionId },
      userId,
    );
    await this.recordTimeline(
      dto.invoiceId,
      eventType,
      `Invoice ${paymentStatus.paymentStatus === InvoicePaymentStatus.PAID ? 'paid in full' : 'partially paid'}`,
      { totalPaid: paymentStatus.totalPaid, balanceDue: paymentStatus.balanceDue },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_payment.created_manual',
      'CREATE',
      payment.id,
      { invoiceId: dto.invoiceId, amount: dto.amount },
      requestId,
    );

    return { payment, invoiceStatus: paymentStatus };
  }

  // ─── Capture Gateway Payment ──────────────

  async captureGateway(
    orgId: string,
    dto: CaptureGatewayPaymentDto,
    userId: string,
    requestId: string,
  ) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: dto.invoiceId, organizationId: orgId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === SalesInvoiceStatus.VOID) {
      throw new BadRequestException('Cannot add payment to voided invoice');
    }

    const existingPayment = await this.prisma.salesPayment.findFirst({
      where: { transactionId: dto.transactionId, organizationId: orgId },
    });
    if (existingPayment) {
      throw new BadRequestException('A payment with this transaction ID already exists');
    }

    const overpayment = invoice.amountPaid + dto.amount - invoice.grandTotal;
    if (overpayment > 0) {
      throw new BadRequestException(`Payment would overpay invoice by ${overpayment}`);
    }

    const payment = await this.prisma.salesPayment.create({
      data: {
        organizationId: orgId,
        invoiceId: dto.invoiceId,
        gateway: dto.gateway,
        transactionId: dto.transactionId,
        amount: dto.amount,
        currency: dto.currency || invoice.currency,
        paymentMethod: dto.paymentMethod || null,
        status: SalesPaymentStatus.CAPTURED,
        paidAt: new Date(),
        metadata: (dto.metadata as Prisma.InputJsonValue) || Prisma.JsonNull,
      },
      include: {
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    });

    await this.prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        invoiceId: dto.invoiceId,
        allocatedAmount: dto.amount,
      },
    });

    const paymentStatus = await this.updateInvoicePaymentStatus(dto.invoiceId);

    const eventType =
      paymentStatus.paymentStatus === InvoicePaymentStatus.PAID
        ? 'invoice.paid'
        : 'invoice.partially_paid';

    await this.recordTimeline(
      dto.invoiceId,
      'payment.created',
      `${dto.gateway} payment of ${dto.amount} ${dto.currency || invoice.currency} captured`,
      {
        paymentId: payment.id,
        amount: dto.amount,
        gateway: dto.gateway,
        transactionId: dto.transactionId,
      },
      userId,
    );
    await this.recordTimeline(
      dto.invoiceId,
      eventType,
      `Invoice ${paymentStatus.paymentStatus === InvoicePaymentStatus.PAID ? 'paid in full' : 'partially paid'}`,
      { totalPaid: paymentStatus.totalPaid, balanceDue: paymentStatus.balanceDue },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_payment.captured',
      'CREATE',
      payment.id,
      { invoiceId: dto.invoiceId, amount: dto.amount, gateway: dto.gateway },
      requestId,
    );

    return { payment, invoiceStatus: paymentStatus };
  }

  // ─── Allocate Payment ──────────────────────

  async allocate(
    orgId: string,
    paymentId: string,
    invoiceId: string,
    amount: number,
    userId: string,
    requestId: string,
  ) {
    const payment = await this.findPaymentOrThrow(orgId, paymentId);
    if (payment.status !== SalesPaymentStatus.CAPTURED) {
      throw new BadRequestException('Only captured payments can be allocated');
    }

    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id: invoiceId, organizationId: orgId, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const existingAllocations = await this.prisma.paymentAllocation.aggregate({
      where: { paymentId },
      _sum: { allocatedAmount: true },
    });
    const totalAllocated = existingAllocations._sum.allocatedAmount || 0;
    const remaining = payment.amount - totalAllocated;

    if (amount > remaining) {
      throw new BadRequestException(
        `Payment has only ${remaining} unallocated. Cannot allocate ${amount}.`,
      );
    }

    const allocation = await this.prisma.paymentAllocation.create({
      data: {
        paymentId,
        invoiceId,
        allocatedAmount: amount,
      },
    });

    await this.updateInvoicePaymentStatus(invoiceId);

    await this.recordTimeline(
      invoiceId,
      'payment.allocated',
      `Payment of ${amount} allocated to invoice`,
      { paymentId, allocationId: allocation.id },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_payment.allocated',
      'UPDATE',
      paymentId,
      { invoiceId, allocatedAmount: amount },
      requestId,
    );

    return allocation;
  }

  // ─── Refund Payment ────────────────────────

  async refund(orgId: string, dto: RefundPaymentDto, userId: string, requestId: string) {
    const payment = await this.findPaymentOrThrow(orgId, dto.paymentId);
    if (payment.status !== SalesPaymentStatus.CAPTURED) {
      throw new BadRequestException('Only captured payments can be refunded');
    }

    const refundAmount = dto.amount || payment.amount;

    if (refundAmount > payment.amount) {
      throw new BadRequestException('Refund amount cannot exceed original payment amount');
    }

    const updated = await this.prisma.salesPayment.update({
      where: { id: dto.paymentId },
      data: {
        status: SalesPaymentStatus.REFUNDED,
        metadata: {
          ...((payment.metadata as Record<string, unknown>) || {}),
          refundReason: dto.reason,
        },
      },
    });

    if (payment.invoiceId) {
      const refundAllocation = await this.prisma.paymentAllocation.findFirst({
        where: { paymentId: dto.paymentId, invoiceId: payment.invoiceId },
        orderBy: { createdAt: 'desc' },
      });

      if (refundAllocation) {
        await this.prisma.paymentAllocation.update({
          where: { id: refundAllocation.id },
          data: { allocatedAmount: Math.max(0, refundAllocation.allocatedAmount - refundAmount) },
        });
      }

      await this.updateInvoicePaymentStatus(payment.invoiceId);

      await this.recordTimeline(
        payment.invoiceId,
        'payment.refunded',
        `Payment of ${refundAmount} refunded${dto.reason ? `: ${dto.reason}` : ''}`,
        { paymentId: dto.paymentId, refundAmount },
        userId,
      );
    }

    await this.log(
      orgId,
      userId,
      'sales_payment.refunded',
      'UPDATE',
      dto.paymentId,
      { refundAmount, reason: dto.reason },
      requestId,
    );

    return updated;
  }

  // ─── Read ──────────────────────────────────

  async findAll(orgId: string, query: PaymentQueryDto) {
    const {
      search,
      invoiceId,
      gateway,
      status,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };

    if (search) {
      where.OR = [{ transactionId: { contains: search, mode: 'insensitive' } }];
    }
    if (invoiceId) where.invoiceId = invoiceId;
    if (gateway) where.gateway = gateway;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date | string> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.salesPayment.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
          allocations: true,
        },
      }),
      this.prisma.salesPayment.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    return this.findPaymentOrThrow(orgId, id);
  }

  async findByInvoice(orgId: string, invoiceId: string) {
    return this.prisma.salesPayment.findMany({
      where: { organizationId: orgId, invoiceId },
      orderBy: { createdAt: 'desc' },
      include: { allocations: true },
    });
  }
}
