import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, SalesOrderStatus, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PricingService } from '../pricing.service';
import { CreateSalesOrderDto } from './dto/create-sales-order.dto';
import { UpdateSalesOrderDto } from './dto/update-sales-order.dto';
import { SalesOrderQueryDto } from './dto/sales-order-query.dto';

const VALID_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  [SalesOrderStatus.DRAFT]: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.CONFIRMED]: [SalesOrderStatus.PROCESSING, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.PROCESSING]: [
    SalesOrderStatus.PARTIALLY_FULFILLED,
    SalesOrderStatus.FULFILLED,
    SalesOrderStatus.CANCELLED,
  ],
  [SalesOrderStatus.PARTIALLY_FULFILLED]: [SalesOrderStatus.FULFILLED, SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.FULFILLED]: [SalesOrderStatus.CANCELLED],
  [SalesOrderStatus.CANCELLED]: [],
};

@Injectable()
export class SalesOrdersService {
  private readonly logger = new Logger(SalesOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly pricing: PricingService,
  ) {}

  // ─── Private Helpers ───────────────────────

  private async recordTimeline(
    salesOrderId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.salesOrderTimeline.create({
      data: {
        salesOrderId,
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
      resource: 'sales_order',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async generateOrderNumber(orgId: string): Promise<string> {
    const count = await this.prisma.salesOrder.count({
      where: { organizationId: orgId },
    });
    return `ORD-${String(count + 1).padStart(6, '0')}`;
  }

  private async findOrderOrThrow(orgId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        deal: { select: { id: true, title: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    return order;
  }

  private async recalculateAndUpdate(orgId: string, id: string, shippingAmount?: number) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId: orgId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Sales order not found');

    const pricingInput = {
      lineItems: order.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: null,
      discountValue: 0,
      shippingAmount: shippingAmount ?? order.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: {
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        grandTotal: pricingResult.grandTotal,
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return updated;
  }

  private async validateStatusTransition(id: string, from: SalesOrderStatus, to: SalesOrderStatus) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(`Invalid status transition from ${from} to ${to}`);
    }
  }

  // ─── Create ────────────────────────────────

  async create(orgId: string, dto: CreateSalesOrderDto, userId: string, requestId: string) {
    const orderNumber = await this.generateOrderNumber(orgId);

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

    const order = await this.prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        orderNumber,
        companyId: dto.companyId,
        contactId: dto.contactId,
        dealId: dto.dealId || null,
        ownerId: userId,
        orderDate: new Date(dto.orderDate),
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        currency: dto.currency || 'USD',
        exchangeRate: dto.exchangeRate ?? 1,
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: dto.shippingAmount ?? 0,
        grandTotal: pricingResult.grandTotal,
        notes: dto.notes || null,
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
      order.id,
      'order.created',
      `Sales order ${order.orderNumber} created`,
      { orderNumber: order.orderNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_order.created',
      'CREATE',
      order.id,
      { orderNumber: order.orderNumber },
      requestId,
    );

    return order;
  }

  // ─── Convert from Quotation ────────────────

  async convertFromQuotation(
    orgId: string,
    quotationId: string,
    userId: string,
    requestId: string,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, organizationId: orgId, deletedAt: null },
      include: { items: { orderBy: { displayOrder: 'asc' } } },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    if (quotation.status !== QuotationStatus.ACCEPTED) {
      throw new BadRequestException('Only accepted quotations can be converted to sales orders');
    }

    const existingOrder = await this.prisma.salesOrder.findFirst({
      where: { quotationId, deletedAt: null },
    });
    if (existingOrder) {
      throw new BadRequestException('A sales order already exists for this quotation');
    }

    const orderNumber = await this.generateOrderNumber(orgId);

    const pricingInput = {
      lineItems: quotation.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: null,
      discountValue: 0,
      shippingAmount: quotation.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const order = await this.prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        orderNumber,
        quotationId: quotation.id,
        companyId: quotation.companyId,
        contactId: quotation.contactId,
        dealId: quotation.dealId,
        ownerId: userId,
        orderDate: new Date(),
        expectedDeliveryDate: null,
        currency: quotation.currency,
        exchangeRate: quotation.exchangeRate,
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: quotation.shippingAmount,
        grandTotal: pricingResult.grandTotal,
        notes: quotation.notes,
        items: {
          create: pricingResult.lineItems.map((item, index) => ({
            productId: quotation.items[index].productId,
            description: quotation.items[index].description,
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
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      order.id,
      'order.converted_from_quotation',
      `Sales order ${order.orderNumber} created from quotation ${quotation.quotationNumber}`,
      { quotationId: quotation.id, quotationNumber: quotation.quotationNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_order.converted_from_quotation',
      'CREATE',
      order.id,
      { quotationId: quotation.id, quotationNumber: quotation.quotationNumber },
      requestId,
    );

    return order;
  }

  // ─── Read ──────────────────────────────────

  async findAll(orgId: string, query: SalesOrderQueryDto) {
    const {
      search,
      status,
      companyId,
      contactId,
      ownerId,
      orderDateFrom,
      orderDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [{ orderNumber: { contains: search, mode: 'insensitive' } }];
    }
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (contactId) where.contactId = contactId;
    if (ownerId) where.ownerId = ownerId;
    if (orderDateFrom || orderDateTo) {
      const orderDate: Record<string, Date | string> = {};
      if (orderDateFrom) orderDate.gte = new Date(orderDateFrom);
      if (orderDateTo) orderDate.lte = new Date(orderDateTo);
      where.orderDate = orderDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
          quotation: { select: { id: true, quotationNumber: true } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, fullName: true, email: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.salesOrder.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    return this.findOrderOrThrow(orgId, id);
  }

  // ─── Update ────────────────────────────────

  async update(
    orgId: string,
    id: string,
    dto: UpdateSalesOrderDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findOrderOrThrow(orgId, id);

    if (existing.status !== SalesOrderStatus.DRAFT) {
      throw new BadRequestException('Only draft sales orders can be edited');
    }

    const data: Record<string, unknown> = {};
    if (dto.orderDate !== undefined) data.orderDate = new Date(dto.orderDate);
    if (dto.expectedDeliveryDate !== undefined)
      data.expectedDeliveryDate = dto.expectedDeliveryDate
        ? new Date(dto.expectedDeliveryDate)
        : null;
    if (dto.actualDeliveryDate !== undefined)
      data.actualDeliveryDate = dto.actualDeliveryDate ? new Date(dto.actualDeliveryDate) : null;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;
    if (dto.shippingAmount !== undefined) data.shippingAmount = dto.shippingAmount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const shippingAmount = dto.shippingAmount ?? existing.shippingAmount;

    if (Object.keys(data).length > 0) {
      await this.prisma.salesOrder.update({ where: { id }, data });
    }

    if (dto.items !== undefined && dto.items.length > 0) {
      await this.prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } });

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

      await this.prisma.salesOrderItem.createMany({
        data: pricingResult.lineItems.map((item, index) => ({
          salesOrderId: id,
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
      'order.updated',
      `Sales order ${updated.orderNumber} updated`,
      { changes: Object.keys(data) },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_order.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );

    return updated;
  }

  // ─── Status Transitions ────────────────────

  async confirm(orgId: string, id: string, userId: string, requestId: string) {
    const order = await this.findOrderOrThrow(orgId, id);
    await this.validateStatusTransition(id, order.status, SalesOrderStatus.CONFIRMED);

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CONFIRMED },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'order.confirmed',
      `Sales order ${updated.orderNumber} confirmed`,
      {},
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_order.confirmed',
      'UPDATE',
      id,
      { status: SalesOrderStatus.CONFIRMED },
      requestId,
    );

    return updated;
  }

  async changeStatus(
    orgId: string,
    id: string,
    newStatus: SalesOrderStatus,
    userId: string,
    requestId: string,
  ) {
    const order = await this.findOrderOrThrow(orgId, id);
    await this.validateStatusTransition(id, order.status, newStatus);

    const statusData: Record<string, unknown> = { status: newStatus };
    if (newStatus === SalesOrderStatus.FULFILLED) {
      statusData.actualDeliveryDate = new Date();
    }

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: statusData,
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const event = `order.status_changed`;
    const desc = `Status changed from ${order.status} to ${newStatus}`;

    await this.recordTimeline(id, event, desc, { from: order.status, to: newStatus }, userId);
    await this.log(
      orgId,
      userId,
      'sales_order.status_changed',
      'UPDATE',
      id,
      { from: order.status, to: newStatus },
      requestId,
    );

    return updated;
  }

  async cancel(orgId: string, id: string, userId: string, requestId: string, reason?: string) {
    const order = await this.findOrderOrThrow(orgId, id);
    await this.validateStatusTransition(id, order.status, SalesOrderStatus.CANCELLED);

    const updated = await this.prisma.salesOrder.update({
      where: { id },
      data: { status: SalesOrderStatus.CANCELLED },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        quotation: { select: { id: true, quotationNumber: true } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'order.cancelled',
      `Sales order ${updated.orderNumber} cancelled${reason ? `: ${reason}` : ''}`,
      { reason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_order.cancelled',
      'UPDATE',
      id,
      { status: SalesOrderStatus.CANCELLED, reason },
      requestId,
    );

    return updated;
  }

  // ─── Duplicate ─────────────────────────────

  async duplicate(orgId: string, id: string, userId: string, requestId: string) {
    const source = await this.findOrderOrThrow(orgId, id);
    const orderNumber = await this.generateOrderNumber(orgId);

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

    const order = await this.prisma.salesOrder.create({
      data: {
        organizationId: orgId,
        orderNumber,
        companyId: source.companyId,
        contactId: source.contactId,
        dealId: source.dealId,
        ownerId: userId,
        orderDate: new Date(),
        currency: source.currency,
        exchangeRate: source.exchangeRate,
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: source.shippingAmount,
        grandTotal: pricingResult.grandTotal,
        notes: source.notes,
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
      order.id,
      'order.created',
      `Sales order ${order.orderNumber} created (duplicate of ${source.orderNumber})`,
      { sourceOrderId: id, sourceOrderNumber: source.orderNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'sales_order.duplicated',
      'CREATE',
      order.id,
      { sourceOrderId: id, sourceOrderNumber: source.orderNumber },
      requestId,
    );

    return order;
  }

  // ─── Soft Delete / Restore ─────────────────

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    const order = await this.findOrderOrThrow(orgId, id);
    if (
      order.status === SalesOrderStatus.CONFIRMED ||
      order.status === SalesOrderStatus.PROCESSING
    ) {
      throw new BadRequestException('Active orders cannot be archived. Cancel them first.');
    }

    await this.prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'Archived' },
    });

    await this.recordTimeline(id, 'order.archived', 'Sales order archived', {}, userId);
    await this.log(orgId, userId, 'sales_order.archived', 'UPDATE', id, {}, requestId);
    return { message: 'Sales order archived' };
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!order) throw new NotFoundException('Sales order not found');
    if (!order.deletedAt) throw new BadRequestException('Sales order is not archived');

    await this.prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: null, deletedByUserId: null, deletedReason: null },
    });

    await this.recordTimeline(
      id,
      'order.restored',
      'Sales order restored from archive',
      {},
      userId,
    );
    await this.log(orgId, userId, 'sales_order.restored', 'UPDATE', id, {}, requestId);
    return this.findOrderOrThrow(orgId, id);
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOrderOrThrow(orgId, id);
    await this.prisma.salesOrder.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'sales_order.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Sales order deleted' };
  }

  // ─── Timeline ──────────────────────────────

  async getTimeline(orgId: string, salesOrderId: string, page = 1, limit = 50) {
    await this.findOrderOrThrow(orgId, salesOrderId);
    const where = { salesOrderId };
    const [data, total] = await Promise.all([
      this.prisma.salesOrderTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.salesOrderTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
