import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, SalesInvoiceStatus, InvoicePaymentStatus, SalesOrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PricingService } from '../sales/pricing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

const VALID_TRANSITIONS: Record<SalesInvoiceStatus, SalesInvoiceStatus[]> = {
  [SalesInvoiceStatus.DRAFT]: [SalesInvoiceStatus.SENT, SalesInvoiceStatus.VOID],
  [SalesInvoiceStatus.SENT]: [
    SalesInvoiceStatus.VIEWED,
    SalesInvoiceStatus.PAID,
    SalesInvoiceStatus.VOID,
  ],
  [SalesInvoiceStatus.VIEWED]: [
    SalesInvoiceStatus.PARTIALLY_PAID,
    SalesInvoiceStatus.PAID,
    SalesInvoiceStatus.VOID,
  ],
  [SalesInvoiceStatus.PARTIALLY_PAID]: [SalesInvoiceStatus.PAID, SalesInvoiceStatus.VOID],
  [SalesInvoiceStatus.PAID]: [SalesInvoiceStatus.VOID],
  [SalesInvoiceStatus.VOID]: [],
};

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly pricing: PricingService,
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
      resource: 'sales_invoice',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async generateInvoiceNumber(orgId: string): Promise<string> {
    const count = await this.prisma.salesInvoice.count({
      where: { organizationId: orgId },
    });
    return `INV-${String(count + 1).padStart(6, '0')}`;
  }

  private async findInvoiceOrThrow(orgId: string, id: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        salesOrder: { select: { id: true, orderNumber: true } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async recalculateAndUpdate(orgId: string, id: string, shippingAmount?: number) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, organizationId: orgId },
      include: { items: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const pricingInput = {
      lineItems: invoice.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: null,
      discountValue: 0,
      shippingAmount: shippingAmount ?? invoice.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);
    const balanceDue = Math.max(0, pricingResult.grandTotal - invoice.amountPaid);

    const updated = await this.prisma.salesInvoice.update({
      where: { id },
      data: {
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        grandTotal: pricingResult.grandTotal,
        balanceDue,
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        salesOrder: { select: { id: true, orderNumber: true } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return updated;
  }

  private async validateStatusTransition(
    id: string,
    from: SalesInvoiceStatus,
    to: SalesInvoiceStatus,
  ) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(`Invalid status transition from ${from} to ${to}`);
    }
  }

  // ─── Create ────────────────────────────────

  async create(orgId: string, dto: CreateInvoiceDto, userId: string, requestId: string) {
    const invoiceNumber = await this.generateInvoiceNumber(orgId);

    const pricingInput = {
      lineItems: dto.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
        taxRate: item.taxRate ?? 0,
      })),
      discountType: null,
      discountValue: 0,
      shippingAmount: dto.shippingAmount ?? 0,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const invoice = await this.prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        companyId: dto.companyId,
        contactId: dto.contactId,
        ownerId: userId,
        issueDate: new Date(dto.issueDate),
        dueDate: new Date(dto.dueDate),
        currency: dto.currency || 'USD',
        exchangeRate: dto.exchangeRate ?? 1,
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: dto.shippingAmount ?? 0,
        grandTotal: pricingResult.grandTotal,
        amountPaid: 0,
        balanceDue: pricingResult.grandTotal,
        paymentStatus: InvoicePaymentStatus.UNPAID,
        notes: dto.notes || null,
        terms: dto.terms || null,
        items: {
          create: pricingResult.lineItems.map((item, index) => ({
            productId: dto.items[index].productId,
            description: dto.items[index].description || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
            displayOrder: index,
          })),
        },
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      invoice.id,
      'invoice.created',
      `Invoice ${invoice.invoiceNumber} created`,
      { invoiceNumber: invoice.invoiceNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_invoice.created',
      'CREATE',
      invoice.id,
      { invoiceNumber: invoice.invoiceNumber },
      requestId,
    );

    return invoice;
  }

  // ─── Create from Sales Order ───────────────

  async createFromSalesOrder(
    orgId: string,
    salesOrderId: string,
    userId: string,
    requestId: string,
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: salesOrderId, organizationId: orgId, deletedAt: null },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Sales order not found');

    if (order.status !== SalesOrderStatus.FULFILLED) {
      throw new BadRequestException('Only fulfilled sales orders can be invoiced');
    }

    const existingInvoice = await this.prisma.salesInvoice.findFirst({
      where: { salesOrderId, deletedAt: null },
    });
    if (existingInvoice) {
      throw new BadRequestException('An invoice already exists for this sales order');
    }

    const invoiceNumber = await this.generateInvoiceNumber(orgId);

    const pricingInput = {
      lineItems: order.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: null,
      discountValue: 0,
      shippingAmount: order.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const invoice = await this.prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        salesOrderId: order.id,
        quotationId: order.quotationId,
        companyId: order.companyId,
        contactId: order.contactId,
        ownerId: userId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: order.currency,
        exchangeRate: order.exchangeRate,
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: order.shippingAmount,
        grandTotal: pricingResult.grandTotal,
        amountPaid: 0,
        balanceDue: pricingResult.grandTotal,
        paymentStatus: InvoicePaymentStatus.UNPAID,
        notes: order.notes,
        items: {
          create: pricingResult.lineItems.map((item, index) => ({
            productId: order.items[index].productId,
            description: order.items[index].description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
            displayOrder: index,
          })),
        },
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        salesOrder: { select: { id: true, orderNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      invoice.id,
      'invoice.generated_from_order',
      `Invoice ${invoice.invoiceNumber} generated from sales order ${order.orderNumber}`,
      { salesOrderId: order.id, orderNumber: order.orderNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_invoice.generated_from_order',
      'CREATE',
      invoice.id,
      { salesOrderId: order.id, orderNumber: order.orderNumber },
      requestId,
    );

    return invoice;
  }

  // ─── Read ──────────────────────────────────

  async findAll(orgId: string, query: InvoiceQueryDto) {
    const {
      search,
      status,
      paymentStatus,
      companyId,
      contactId,
      ownerId,
      issueDateFrom,
      issueDateTo,
      dueDateFrom,
      dueDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [{ invoiceNumber: { contains: search, mode: 'insensitive' } }];
    }
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (companyId) where.companyId = companyId;
    if (contactId) where.contactId = contactId;
    if (ownerId) where.ownerId = ownerId;
    if (issueDateFrom || issueDateTo) {
      const issueDate: Record<string, Date | string> = {};
      if (issueDateFrom) issueDate.gte = new Date(issueDateFrom);
      if (issueDateTo) issueDate.lte = new Date(issueDateTo);
      where.issueDate = issueDate;
    }
    if (dueDateFrom || dueDateTo) {
      const dueDate: Record<string, Date | string> = {};
      if (dueDateFrom) dueDate.gte = new Date(dueDateFrom);
      if (dueDateTo) dueDate.lte = new Date(dueDateTo);
      where.dueDate = dueDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
          salesOrder: { select: { id: true, orderNumber: true } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, fullName: true, email: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.salesInvoice.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    return this.findInvoiceOrThrow(orgId, id);
  }

  // ─── Update Draft ──────────────────────────

  async update(
    orgId: string,
    id: string,
    dto: UpdateInvoiceDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findInvoiceOrThrow(orgId, id);

    if (existing.status !== SalesInvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    const data: Record<string, unknown> = {};
    if (dto.issueDate !== undefined) data.issueDate = new Date(dto.issueDate);
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;
    if (dto.shippingAmount !== undefined) data.shippingAmount = dto.shippingAmount;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.terms !== undefined) data.terms = dto.terms;

    const shippingAmount = dto.shippingAmount ?? existing.shippingAmount;

    if (Object.keys(data).length > 0) {
      await this.prisma.salesInvoice.update({ where: { id }, data });
    }

    if (dto.items !== undefined && dto.items.length > 0) {
      await this.prisma.salesInvoiceItem.deleteMany({ where: { invoiceId: id } });

      const pricingInput = {
        lineItems: dto.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
          taxRate: item.taxRate ?? 0,
        })),
        discountType: null,
        discountValue: 0,
        shippingAmount,
      };

      const pricingResult = this.pricing.calculateSummary(pricingInput);

      await this.prisma.salesInvoiceItem.createMany({
        data: pricingResult.lineItems.map((item, index) => ({
          invoiceId: id,
          productId: dto.items![index].productId,
          description: dto.items![index].description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
          taxRate: item.taxRate,
          lineTotal: item.lineTotal,
          displayOrder: index,
        })),
      });
    }

    const updated = await this.recalculateAndUpdate(orgId, id, shippingAmount);

    await this.recordTimeline(
      id,
      'invoice.updated',
      `Invoice ${updated.invoiceNumber} updated`,
      { changes: Object.keys(data) },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_invoice.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );

    return updated;
  }

  // ─── Duplicate ─────────────────────────────

  async duplicate(orgId: string, id: string, userId: string, requestId: string) {
    const source = await this.findInvoiceOrThrow(orgId, id);
    const invoiceNumber = await this.generateInvoiceNumber(orgId);

    const pricingInput = {
      lineItems: source.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: null,
      discountValue: 0,
      shippingAmount: source.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const invoice = await this.prisma.salesInvoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        companyId: source.companyId,
        contactId: source.contactId,
        ownerId: userId,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: source.currency,
        exchangeRate: source.exchangeRate,
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: source.shippingAmount,
        grandTotal: pricingResult.grandTotal,
        amountPaid: 0,
        balanceDue: pricingResult.grandTotal,
        paymentStatus: InvoicePaymentStatus.UNPAID,
        notes: source.notes,
        terms: source.terms,
        items: {
          create: pricingResult.lineItems.map((item, index) => ({
            productId: source.items[index].productId,
            description: source.items[index].description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
            displayOrder: index,
          })),
        },
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      invoice.id,
      'invoice.created',
      `Invoice ${invoice.invoiceNumber} created (duplicate of ${source.invoiceNumber})`,
      { sourceInvoiceId: id, sourceInvoiceNumber: source.invoiceNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_invoice.duplicated',
      'CREATE',
      invoice.id,
      { sourceInvoiceId: id, sourceInvoiceNumber: source.invoiceNumber },
      requestId,
    );

    return invoice;
  }

  // ─── Status Transitions ────────────────────

  async send(orgId: string, id: string, userId: string, requestId: string) {
    const invoice = await this.findInvoiceOrThrow(orgId, id);
    await this.validateStatusTransition(id, invoice.status, SalesInvoiceStatus.SENT);

    const updated = await this.prisma.salesInvoice.update({
      where: { id },
      data: { status: SalesInvoiceStatus.SENT },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'invoice.sent',
      `Invoice ${updated.invoiceNumber} sent to customer`,
      {},
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_invoice.sent',
      'UPDATE',
      id,
      { status: SalesInvoiceStatus.SENT },
      requestId,
    );

    return updated;
  }

  async void(orgId: string, id: string, userId: string, requestId: string, reason?: string) {
    const invoice = await this.findInvoiceOrThrow(orgId, id);
    await this.validateStatusTransition(id, invoice.status, SalesInvoiceStatus.VOID);

    const updated = await this.prisma.salesInvoice.update({
      where: { id },
      data: { status: SalesInvoiceStatus.VOID },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'invoice.voided',
      `Invoice ${updated.invoiceNumber} voided${reason ? `: ${reason}` : ''}`,
      { reason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_invoice.voided',
      'UPDATE',
      id,
      { status: SalesInvoiceStatus.VOID, reason },
      requestId,
    );

    return updated;
  }

  // ─── Archive / Restore / Delete ────────────

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    const invoice = await this.findInvoiceOrThrow(orgId, id);
    if (
      invoice.status === SalesInvoiceStatus.SENT ||
      invoice.status === SalesInvoiceStatus.VIEWED
    ) {
      throw new BadRequestException('Active invoices cannot be archived. Void them first.');
    }

    await this.prisma.salesInvoice.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'Archived' },
    });

    await this.recordTimeline(id, 'invoice.archived', 'Invoice archived', {}, userId);
    await this.log(orgId, userId, 'sales_invoice.archived', 'UPDATE', id, {}, requestId);
    return { message: 'Invoice archived' };
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    const invoice = await this.prisma.salesInvoice.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.deletedAt) throw new BadRequestException('Invoice is not archived');

    await this.prisma.salesInvoice.update({
      where: { id },
      data: { deletedAt: null, deletedByUserId: null, deletedReason: null },
    });

    await this.recordTimeline(id, 'invoice.restored', 'Invoice restored from archive', {}, userId);
    await this.log(orgId, userId, 'sales_invoice.restored', 'UPDATE', id, {}, requestId);
    return this.findInvoiceOrThrow(orgId, id);
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findInvoiceOrThrow(orgId, id);
    await this.prisma.salesInvoice.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'sales_invoice.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Invoice deleted' };
  }

  // ─── Timeline ──────────────────────────────

  async getTimeline(orgId: string, invoiceId: string, page = 1, limit = 50) {
    await this.findInvoiceOrThrow(orgId, invoiceId);
    const where = { invoiceId };
    const [data, total] = await Promise.all([
      this.prisma.salesInvoiceTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.salesInvoiceTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
