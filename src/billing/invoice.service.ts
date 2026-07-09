import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInvoiceDto) {
    const invoiceNumber = await this.generateInvoiceNumber(dto.organizationId);
    const totalAmount = (dto.amount ?? 0) + (dto.taxAmount ?? 0) - (dto.discountAmount ?? 0);

    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId: dto.organizationId,
        subscriptionId: dto.subscriptionId ?? null,
        invoiceNumber,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        taxAmount: dto.taxAmount ?? 0,
        discountAmount: dto.discountAmount ?? 0,
        totalAmount: Math.max(0, totalAmount),
        periodStart: dto.periodStart ? new Date(dto.periodStart) : null,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        billingAddressId: dto.billingAddressId ?? null,
        notes: dto.notes ?? null,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    this.logger.log(`Invoice created: ${invoice.id} (#${invoiceNumber})`);
    return invoice;
  }

  async findById(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id, deletedAt: null },
      include: {
        payments: true,
        billingAddress: true,
        couponUsages: { include: { coupon: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findByNumber(organizationId: string, invoiceNumber: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { organizationId_invoiceNumber: { organizationId, invoiceNumber } },
      include: {
        payments: true,
        billingAddress: true,
        couponUsages: { include: { coupon: true } },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async findAll(query: InvoiceQueryDto) {
    const {
      organizationId,
      subscriptionId,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.InvoiceWhereInput = { deletedAt: null };

    if (organizationId) where.organizationId = organizationId;
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (status) where.status = status;
    if (search) {
      where.invoiceNumber = { contains: search, mode: 'insensitive' };
    }

    const orderBy: Prisma.InvoiceOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          payments: { select: { id: true, status: true, amount: true } },
          _count: { select: { payments: true } },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markPaid(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID') return invoice;

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    });

    this.logger.log(`Invoice marked paid: ${id} (#${invoice.invoiceNumber})`);
    return updated;
  }

  async issue(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot issue invoice with status "${invoice.status}"`);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'ISSUED' },
    });

    this.logger.log(`Invoice issued: ${id} (#${invoice.invoiceNumber})`);
    return updated;
  }

  async cancel(id: string, reason?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELED') {
      throw new BadRequestException(`Cannot cancel invoice with status "${invoice.status}"`);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELED', notes: reason ?? invoice.notes ?? null },
    });

    this.logger.log(`Invoice canceled: ${id} (#${invoice.invoiceNumber})`);
    return updated;
  }

  async softDelete(id: string, userId: string, reason?: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id, deletedAt: null },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    await this.prisma.invoice.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
        deletedReason: reason ?? null,
      },
    });

    this.logger.log(`Invoice soft-deleted: ${id} (#${invoice.invoiceNumber})`);
  }

  private async generateInvoiceNumber(organizationId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const prefix = `INV-${year}${month}-`;

    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        organizationId,
        invoiceNumber: { startsWith: prefix },
      },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });

    let sequence = 1;
    if (lastInvoice) {
      const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-').pop() ?? '0', 10);
      sequence = lastSeq + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}
