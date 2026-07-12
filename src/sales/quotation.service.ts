import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma, QuotationStatus, DiscountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PricingService } from './pricing.service';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import { QuotationQueryDto } from './dto/quotation-query.dto';
import { CreateQuotationItemDto } from './dto/create-quotation-item.dto';
import { UpdateQuotationItemDto } from './dto/update-quotation-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';

const VALID_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  [QuotationStatus.DRAFT]: [QuotationStatus.SENT, QuotationStatus.CANCELLED],
  [QuotationStatus.SENT]: [
    QuotationStatus.VIEWED,
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.EXPIRED,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.VIEWED]: [
    QuotationStatus.ACCEPTED,
    QuotationStatus.REJECTED,
    QuotationStatus.EXPIRED,
    QuotationStatus.CANCELLED,
  ],
  [QuotationStatus.ACCEPTED]: [QuotationStatus.CANCELLED],
  [QuotationStatus.REJECTED]: [],
  [QuotationStatus.EXPIRED]: [],
  [QuotationStatus.CANCELLED]: [],
};

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly pricing: PricingService,
  ) {}

  // ─── Private Helpers ───────────────────────

  private async recordTimeline(
    quotationId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.quotationTimeline.create({
      data: {
        quotationId,
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
      resource: 'quotation',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async generateQuotationNumber(orgId: string): Promise<string> {
    const count = await this.prisma.quotation.count({
      where: { organizationId: orgId },
    });
    return `QTN-${String(count + 1).padStart(6, '0')}`;
  }

  private async findQuotationOrThrow(orgId: string, id: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        deal: { select: { id: true, title: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        timeline: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  private async recalculateAndUpdate(
    orgId: string,
    id: string,
    _userId: string,
    _requestId: string,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId: orgId },
      include: { items: true },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');

    const pricingInput = {
      lineItems: quotation.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: quotation.discountType as DiscountType | null | undefined,
      discountValue: quotation.discountValue,
      shippingAmount: quotation.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: {
        subtotal: pricingResult.subtotal,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        grandTotal: pricingResult.grandTotal,
      },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    return updated;
  }

  private async validateStatusTransition(id: string, from: QuotationStatus, to: QuotationStatus) {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      throw new BadRequestException(`Invalid status transition from ${from} to ${to}`);
    }
  }

  // ─── Create ────────────────────────────────

  async create(orgId: string, dto: CreateQuotationDto, userId: string, requestId: string) {
    const quotationNumber = await this.generateQuotationNumber(orgId);

    const pricingInput = {
      lineItems: dto.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount ?? 0,
        taxRate: item.taxRate ?? 0,
      })),
      discountType: dto.discountType ?? null,
      discountValue: dto.discountValue ?? 0,
      shippingAmount: dto.shippingAmount ?? 0,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const quotation = await this.prisma.quotation.create({
      data: {
        organizationId: orgId,
        quotationNumber,
        companyId: dto.companyId,
        contactId: dto.contactId,
        dealId: dto.dealId || null,
        ownerId: userId,
        issueDate: new Date(dto.issueDate),
        expiryDate: new Date(dto.expiryDate),
        currency: dto.currency || 'USD',
        exchangeRate: dto.exchangeRate ?? 1,
        subtotal: pricingResult.subtotal,
        discountType: dto.discountType ?? null,
        discountValue: dto.discountValue ?? 0,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: dto.shippingAmount ?? 0,
        grandTotal: pricingResult.grandTotal,
        notes: dto.notes || null,
        termsAndConditions: dto.termsAndConditions || null,
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
      quotation.id,
      'quotation.created',
      `Quotation ${quotation.quotationNumber} created`,
      { quotationNumber: quotation.quotationNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.created',
      'CREATE',
      quotation.id,
      { quotationNumber: quotation.quotationNumber },
      requestId,
    );

    return quotation;
  }

  // ─── Read ──────────────────────────────────

  async findAll(orgId: string, query: QuotationQueryDto) {
    const {
      search,
      status,
      companyId,
      contactId,
      ownerId,
      issueDateFrom,
      issueDateTo,
      expiryDateFrom,
      expiryDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [{ quotationNumber: { contains: search, mode: 'insensitive' } }];
    }
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    if (contactId) where.contactId = contactId;
    if (ownerId) where.ownerId = ownerId;
    if (issueDateFrom || issueDateTo) {
      const issueDate: Record<string, Date | string> = {};
      if (issueDateFrom) issueDate.gte = new Date(issueDateFrom);
      if (issueDateTo) issueDate.lte = new Date(issueDateTo);
      where.issueDate = issueDate;
    }
    if (expiryDateFrom || expiryDateTo) {
      const expiryDate: Record<string, Date | string> = {};
      if (expiryDateFrom) expiryDate.gte = new Date(expiryDateFrom);
      if (expiryDateTo) expiryDate.lte = new Date(expiryDateTo);
      where.expiryDate = expiryDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: { orderBy: { displayOrder: 'asc' } },
          company: { select: { id: true, name: true } },
          contact: { select: { id: true, fullName: true, email: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    return this.findQuotationOrThrow(orgId, id);
  }

  // ─── Update ────────────────────────────────

  async update(
    orgId: string,
    id: string,
    dto: UpdateQuotationDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findQuotationOrThrow(orgId, id);

    if (existing.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Only draft quotations can be edited');
    }

    const data: Record<string, unknown> = {};
    if (dto.issueDate !== undefined) data.issueDate = new Date(dto.issueDate);
    if (dto.expiryDate !== undefined) data.expiryDate = new Date(dto.expiryDate);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;
    if (dto.discountType !== undefined) data.discountType = dto.discountType;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.shippingAmount !== undefined) data.shippingAmount = dto.shippingAmount;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.termsAndConditions !== undefined) data.termsAndConditions = dto.termsAndConditions;

    if (Object.keys(data).length > 0) {
      await this.prisma.quotation.update({ where: { id }, data });
    }

    if (dto.items !== undefined && dto.items.length > 0) {
      await this.prisma.quotationItem.deleteMany({ where: { quotationId: id } });

      const pricingInput = {
        lineItems: dto.items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount ?? 0,
          taxRate: item.taxRate ?? 0,
        })),
        discountType: (dto.discountType ?? existing.discountType) as
          DiscountType | null | undefined,
        discountValue: dto.discountValue ?? existing.discountValue,
        shippingAmount: dto.shippingAmount ?? existing.shippingAmount,
      };

      const pricingResult = this.pricing.calculateSummary(pricingInput);

      await this.prisma.quotationItem.createMany({
        data: pricingResult.lineItems.map((item, index) => ({
          quotationId: id,
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

    const updated = await this.recalculateAndUpdate(orgId, id, userId, requestId);

    await this.recordTimeline(
      id,
      'quotation.updated',
      `Quotation ${updated.quotationNumber} updated`,
      { changes: Object.keys(data) },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );

    return updated;
  }

  // ─── Archive / Restore / Delete ────────────

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    const quotation = await this.findQuotationOrThrow(orgId, id);
    if (
      quotation.status !== QuotationStatus.DRAFT &&
      quotation.status !== QuotationStatus.CANCELLED
    ) {
      throw new BadRequestException('Only draft or cancelled quotations can be archived');
    }

    await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'Archived' },
    });

    await this.recordTimeline(id, 'quotation.archived', 'Quotation archived', {}, userId);
    await this.log(orgId, userId, 'quotation.archived', 'UPDATE', id, {}, requestId);
    return { message: 'Quotation archived' };
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (!quotation.deletedAt) throw new BadRequestException('Quotation is not archived');

    await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: null, deletedByUserId: null, deletedReason: null },
    });

    await this.recordTimeline(
      id,
      'quotation.restored',
      'Quotation restored from archive',
      {},
      userId,
    );
    await this.log(orgId, userId, 'quotation.restored', 'UPDATE', id, {}, requestId);
    return this.findQuotationOrThrow(orgId, id);
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findQuotationOrThrow(orgId, id);
    await this.prisma.quotation.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'quotation.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Quotation deleted' };
  }

  // ─── Status Transitions ────────────────────

  async send(orgId: string, id: string, userId: string, requestId: string) {
    const quotation = await this.findQuotationOrThrow(orgId, id);
    await this.validateStatusTransition(id, quotation.status, QuotationStatus.SENT);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.SENT },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'quotation.sent',
      `Quotation ${updated.quotationNumber} sent to customer`,
      {},
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.sent',
      'UPDATE',
      id,
      { status: QuotationStatus.SENT },
      requestId,
    );
    return updated;
  }

  async accept(orgId: string, id: string, userId: string, requestId: string) {
    const quotation = await this.findQuotationOrThrow(orgId, id);
    await this.validateStatusTransition(id, quotation.status, QuotationStatus.ACCEPTED);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.ACCEPTED },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'quotation.accepted',
      `Quotation ${updated.quotationNumber} accepted`,
      {},
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.accepted',
      'UPDATE',
      id,
      { status: QuotationStatus.ACCEPTED },
      requestId,
    );
    return updated;
  }

  async reject(orgId: string, id: string, userId: string, requestId: string, reason?: string) {
    const quotation = await this.findQuotationOrThrow(orgId, id);
    await this.validateStatusTransition(id, quotation.status, QuotationStatus.REJECTED);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.REJECTED },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'quotation.rejected',
      `Quotation ${updated.quotationNumber} rejected${reason ? `: ${reason}` : ''}`,
      { reason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.rejected',
      'UPDATE',
      id,
      { status: QuotationStatus.REJECTED, reason },
      requestId,
    );
    return updated;
  }

  async cancel(orgId: string, id: string, userId: string, requestId: string, reason?: string) {
    const quotation = await this.findQuotationOrThrow(orgId, id);
    await this.validateStatusTransition(id, quotation.status, QuotationStatus.CANCELLED);

    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status: QuotationStatus.CANCELLED },
      include: {
        items: { orderBy: { displayOrder: 'asc' } },
        company: { select: { id: true, name: true } },
        contact: { select: { id: true, fullName: true, email: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'quotation.cancelled',
      `Quotation ${updated.quotationNumber} cancelled${reason ? `: ${reason}` : ''}`,
      { reason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.cancelled',
      'UPDATE',
      id,
      { status: QuotationStatus.CANCELLED, reason },
      requestId,
    );
    return updated;
  }

  // ─── Duplicate ─────────────────────────────

  async duplicate(orgId: string, id: string, userId: string, requestId: string) {
    const source = await this.findQuotationOrThrow(orgId, id);
    const quotationNumber = await this.generateQuotationNumber(orgId);

    const pricingInput = {
      lineItems: source.items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        taxRate: item.taxRate,
      })),
      discountType: source.discountType as DiscountType | null | undefined,
      discountValue: source.discountValue,
      shippingAmount: source.shippingAmount,
    };

    const pricingResult = this.pricing.calculateSummary(pricingInput);

    const quotation = await this.prisma.quotation.create({
      data: {
        organizationId: orgId,
        quotationNumber,
        companyId: source.companyId,
        contactId: source.contactId,
        dealId: source.dealId,
        ownerId: userId,
        issueDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        currency: source.currency,
        exchangeRate: source.exchangeRate,
        subtotal: pricingResult.subtotal,
        discountType: source.discountType,
        discountValue: source.discountValue,
        discountAmount: pricingResult.discountAmount,
        taxAmount: pricingResult.taxAmount,
        shippingAmount: source.shippingAmount,
        grandTotal: pricingResult.grandTotal,
        notes: source.notes,
        termsAndConditions: source.termsAndConditions,
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
      quotation.id,
      'quotation.created',
      `Quotation ${quotation.quotationNumber} created (duplicate of ${source.quotationNumber})`,
      { sourceQuotationId: id, sourceQuotationNumber: source.quotationNumber },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'quotation.duplicated',
      'CREATE',
      quotation.id,
      { sourceQuotationId: id, sourceQuotationNumber: source.quotationNumber },
      requestId,
    );

    return quotation;
  }

  // ─── Items ─────────────────────────────────

  async addItem(
    orgId: string,
    quotationId: string,
    dto: CreateQuotationItemDto,
    userId: string,
    requestId: string,
  ) {
    const quotation = await this.findQuotationOrThrow(orgId, quotationId);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Items can only be added to draft quotations');
    }

    const maxOrder = await this.prisma.quotationItem.aggregate({
      where: { quotationId },
      _max: { displayOrder: true },
    });

    const pricingResult = this.pricing.calculateLineItem({
      quantity: dto.quantity,
      unitPrice: dto.unitPrice,
      discount: dto.discount ?? 0,
      taxRate: dto.taxRate ?? 0,
    });

    await this.prisma.quotationItem.create({
      data: {
        quotationId,
        productId: dto.productId,
        description: dto.description || null,
        quantity: pricingResult.quantity,
        unitPrice: pricingResult.unitPrice,
        discount: pricingResult.discount,
        taxRate: pricingResult.taxRate,
        lineTotal: pricingResult.lineTotal,
        displayOrder: (maxOrder._max.displayOrder ?? -1) + 1,
      },
    });

    const updated = await this.recalculateAndUpdate(orgId, quotationId, userId, requestId);

    await this.recordTimeline(
      quotationId,
      'quotation.item_added',
      `Item added to quotation ${updated.quotationNumber}`,
      { productId: dto.productId },
      userId,
    );

    return updated;
  }

  async updateItem(
    orgId: string,
    quotationId: string,
    itemId: string,
    dto: UpdateQuotationItemDto,
    userId: string,
    requestId: string,
  ) {
    const quotation = await this.findQuotationOrThrow(orgId, quotationId);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Items can only be updated in draft quotations');
    }

    const existing = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId },
    });
    if (!existing) throw new NotFoundException('Item not found');

    const itemData: Record<string, unknown> = {};
    if (dto.productId !== undefined) itemData.productId = dto.productId;
    if (dto.description !== undefined) itemData.description = dto.description;
    if (dto.quantity !== undefined) itemData.quantity = dto.quantity;
    if (dto.unitPrice !== undefined) itemData.unitPrice = dto.unitPrice;
    if (dto.discount !== undefined) itemData.discount = dto.discount;
    if (dto.taxRate !== undefined) itemData.taxRate = dto.taxRate;

    const finalQuantity = dto.quantity ?? existing.quantity;
    const finalUnitPrice = dto.unitPrice ?? existing.unitPrice;
    const finalDiscount = dto.discount ?? existing.discount;
    const finalTaxRate = dto.taxRate ?? existing.taxRate;

    const pricingResult = this.pricing.calculateLineItem({
      quantity: finalQuantity,
      unitPrice: finalUnitPrice,
      discount: finalDiscount,
      taxRate: finalTaxRate,
    });

    itemData.lineTotal = pricingResult.lineTotal;

    await this.prisma.quotationItem.update({
      where: { id: itemId },
      data: itemData,
    });

    const updated = await this.recalculateAndUpdate(orgId, quotationId, userId, requestId);

    await this.recordTimeline(
      quotationId,
      'quotation.item_updated',
      `Item updated in quotation ${updated.quotationNumber}`,
      { itemId },
      userId,
    );

    return updated;
  }

  async deleteItem(
    orgId: string,
    quotationId: string,
    itemId: string,
    userId: string,
    requestId: string,
  ) {
    const quotation = await this.findQuotationOrThrow(orgId, quotationId);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Items can only be deleted from draft quotations');
    }

    const existing = await this.prisma.quotationItem.findFirst({
      where: { id: itemId, quotationId },
    });
    if (!existing) throw new NotFoundException('Item not found');

    await this.prisma.quotationItem.delete({ where: { id: itemId } });

    const updated = await this.recalculateAndUpdate(orgId, quotationId, userId, requestId);

    await this.recordTimeline(
      quotationId,
      'quotation.item_deleted',
      `Item removed from quotation ${updated.quotationNumber}`,
      { itemId },
      userId,
    );

    return updated;
  }

  async reorderItems(
    orgId: string,
    quotationId: string,
    dto: ReorderItemsDto,
    userId: string,
    _requestId: string,
  ) {
    const quotation = await this.findQuotationOrThrow(orgId, quotationId);
    if (quotation.status !== QuotationStatus.DRAFT) {
      throw new BadRequestException('Items can only be reordered in draft quotations');
    }

    await Promise.all(
      dto.items.map((item) =>
        this.prisma.quotationItem.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        }),
      ),
    );

    await this.recordTimeline(
      quotationId,
      'quotation.items_reordered',
      `Items reordered in quotation ${quotation.quotationNumber}`,
      {},
      userId,
    );

    return this.findQuotationOrThrow(orgId, quotationId);
  }

  // ─── Timeline ──────────────────────────────

  async getTimeline(orgId: string, quotationId: string, page = 1, limit = 50) {
    await this.findQuotationOrThrow(orgId, quotationId);
    const where = { quotationId };
    const [data, total] = await Promise.all([
      this.prisma.quotationTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.quotationTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
