import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from './dto/purchase-order-query.dto';

@Injectable()
export class PurchaseOrdersService {
  private readonly logger = new Logger(PurchaseOrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

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
      resource: 'purchase_order',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async generatePONumber(orgId: string): Promise<string> {
    const count = await this.prisma.purchaseOrder.count({
      where: { organizationId: orgId },
    });
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `PO-${datePart}-${(count + 1).toString().padStart(4, '0')}`;
  }

  private calculateTotals(items: { quantity: number; unitCost: number; taxRate?: number }[]) {
    let subtotal = 0;
    let taxAmount = 0;

    const lineItems = items.map((item) => {
      const lineTotal = item.quantity * item.unitCost;
      const itemTaxRate = item.taxRate ?? 0;
      const itemTax = Math.round((lineTotal * itemTaxRate) / 100);
      subtotal += lineTotal;
      taxAmount += itemTax;
      return { lineTotal, itemTax };
    });

    return { subtotal, taxAmount, discountAmount: 0, grandTotal: subtotal + taxAmount, lineItems };
  }

  async create(orgId: string, dto: CreatePurchaseOrderDto, userId: string, requestId: string) {
    const [vendor, warehouse] = await Promise.all([
      this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, organizationId: orgId, deletedAt: null },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId: orgId, deletedAt: null },
      }),
    ]);
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    const poNumber = await this.generatePONumber(orgId);
    const { subtotal, taxAmount, discountAmount, grandTotal } = this.calculateTotals(dto.items);

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        poNumber,
        vendorId: dto.vendorId,
        warehouseId: dto.warehouseId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        subtotal,
        taxAmount,
        discountAmount,
        grandTotal,
        notes: dto.notes || null,
        createdBy: userId,
        items: {
          create: dto.items.map((item) => {
            const lineTotal = item.quantity * item.unitCost;
            return {
              productId: item.productId,
              quantity: item.quantity,
              receivedQuantity: 0,
              unitCost: item.unitCost,
              taxRate: item.taxRate ?? 0,
              lineTotal,
            };
          }),
        },
      },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });

    await this.log(
      orgId,
      userId,
      'purchase_order.created',
      'CREATE',
      purchaseOrder.id,
      { poNumber, vendorId: dto.vendorId, itemCount: dto.items.length },
      requestId,
    );
    return purchaseOrder;
  }

  async findAll(orgId: string, query: PurchaseOrderQueryDto) {
    const {
      search,
      status,
      vendorId,
      warehouseId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (vendorId) where.vendorId = vendorId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) {
      where.OR = [{ poNumber: { contains: search, mode: 'insensitive' } }];
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          vendor: { select: { id: true, companyName: true, vendorCode: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, organizationId: orgId },
      include: {
        vendor: {
          select: { id: true, companyName: true, vendorCode: true, email: true, phone: true },
        },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdatePurchaseOrderDto,
    userId: string,
    requestId: string,
  ) {
    const po = await this.findOne(orgId, id);
    if (po.status !== 'DRAFT')
      throw new BadRequestException('Only DRAFT purchase orders can be updated');

    if (dto.vendorId) {
      const vendor = await this.prisma.vendor.findFirst({
        where: { id: dto.vendorId, organizationId: orgId, deletedAt: null },
      });
      if (!vendor) throw new NotFoundException('Vendor not found');
    }
    if (dto.warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId: orgId, deletedAt: null },
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.vendorId !== undefined) data.vendorId = dto.vendorId;
    if (dto.warehouseId !== undefined) data.warehouseId = dto.warehouseId;
    if (dto.expectedDate !== undefined) data.expectedDate = new Date(dto.expectedDate);
    if (dto.notes !== undefined) data.notes = dto.notes;

    if (dto.items) {
      const { subtotal, taxAmount, discountAmount, grandTotal } = this.calculateTotals(dto.items);
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.discountAmount = discountAmount;
      data.grandTotal = grandTotal;

      await this.prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        ...data,
        ...(dto.items
          ? {
              items: {
                create: dto.items.map((item) => {
                  const lineTotal = item.quantity * item.unitCost;
                  return {
                    productId: item.productId,
                    quantity: item.quantity,
                    receivedQuantity: 0,
                    unitCost: item.unitCost,
                    taxRate: item.taxRate ?? 0,
                    lineTotal,
                  };
                }),
              },
            }
          : {}),
      },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });

    await this.log(
      orgId,
      userId,
      'purchase_order.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return updated;
  }

  async approve(orgId: string, id: string, userId: string, requestId: string) {
    const po = await this.findOne(orgId, id);
    if (po.status !== 'DRAFT' && po.status !== 'SENT') {
      throw new BadRequestException(`Cannot approve purchase order in status: ${po.status}`);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });

    await this.log(
      orgId,
      userId,
      'purchase_order.approved',
      'UPDATE',
      id,
      { poNumber: po.poNumber },
      requestId,
    );
    return updated;
  }

  async cancel(
    orgId: string,
    id: string,
    reason: string | null,
    userId: string,
    requestId: string,
  ) {
    const po = await this.findOne(orgId, id);
    if (po.status === 'RECEIVED' || po.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel purchase order in status: ${po.status}`);
    }

    const updated = await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledBy: userId,
        cancelledReason: reason || null,
        cancelledAt: new Date(),
      },
    });

    await this.log(
      orgId,
      userId,
      'purchase_order.cancelled',
      'UPDATE',
      id,
      { reason: reason || null, previousStatus: po.status },
      requestId,
    );
    return updated;
  }

  async duplicate(orgId: string, id: string, userId: string, requestId: string) {
    const source = await this.findOne(orgId, id);
    const poNumber = await this.generatePONumber(orgId);

    const purchaseOrder = await this.prisma.purchaseOrder.create({
      data: {
        organizationId: orgId,
        poNumber,
        vendorId: source.vendorId,
        warehouseId: source.warehouseId,
        expectedDate: source.expectedDate,
        subtotal: source.subtotal,
        taxAmount: source.taxAmount,
        discountAmount: source.discountAmount,
        grandTotal: source.grandTotal,
        notes: source.notes,
        createdBy: userId,
        items: {
          create: source.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            receivedQuantity: 0,
            unitCost: item.unitCost,
            taxRate: item.taxRate,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    });

    await this.log(
      orgId,
      userId,
      'purchase_order.duplicated',
      'CREATE',
      purchaseOrder.id,
      { sourcePoNumber: source.poNumber, newPoNumber: poNumber },
      requestId,
    );
    return purchaseOrder;
  }
}
