import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { StockService } from '../../inventory/stock/stock.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { GoodsReceiptQueryDto } from './dto/goods-receipt-query.dto';

@Injectable()
export class GoodsReceiptService {
  private readonly logger = new Logger(GoodsReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly stock: StockService,
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
      resource: 'goods_receipt',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async generateGRNNumber(orgId: string): Promise<string> {
    const count = await this.prisma.goodsReceipt.count({
      where: { organizationId: orgId },
    });
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `GRN-${datePart}-${(count + 1).toString().padStart(4, '0')}`;
  }

  async create(orgId: string, dto: CreateGoodsReceiptDto, userId: string, requestId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.purchaseOrderId, organizationId: orgId },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    if (po.status === 'CANCELLED')
      throw new BadRequestException('Cannot receive against cancelled purchase order');
    if (po.status === 'DRAFT')
      throw new BadRequestException('Cannot receive against draft purchase order, approve first');

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId: orgId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');

    for (const item of dto.items) {
      const poItem = po.items.find((i) => i.id === item.purchaseOrderItemId);
      if (!poItem)
        throw new NotFoundException(`Purchase order item ${item.purchaseOrderItemId} not found`);
      if (poItem.productId !== item.productId)
        throw new BadRequestException(`Product mismatch for item ${item.purchaseOrderItemId}`);
      const remaining = poItem.quantity - poItem.receivedQuantity;
      if (item.quantity > remaining)
        throw new BadRequestException(
          `Cannot receive ${item.quantity} of product ${item.productId}, only ${remaining} remaining`,
        );
    }

    const grnNumber = await this.generateGRNNumber(orgId);
    const receivedDate = dto.receivedDate ? new Date(dto.receivedDate) : new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const goodsReceipt = await tx.goodsReceipt.create({
        data: {
          organizationId: orgId,
          grnNumber,
          purchaseOrderId: dto.purchaseOrderId,
          warehouseId: dto.warehouseId,
          status: 'RECEIVED' as never,
          receivedDate,
          notes: dto.notes || null,
          createdBy: userId,
          items: {
            create: dto.items.map((item) => ({
              purchaseOrderItemId: item.purchaseOrderItemId,
              productId: item.productId,
              quantity: item.quantity,
              unitCost: 0,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of dto.items) {
        const poItem = po.items.find((i) => i.id === item.purchaseOrderItemId)!;

        await tx.purchaseOrderItem.update({
          where: { id: item.purchaseOrderItemId },
          data: { receivedQuantity: { increment: item.quantity } },
        });

        await this.stock.increase(
          orgId,
          dto.warehouseId,
          item.productId,
          item.quantity,
          'PurchaseOrder',
          dto.purchaseOrderId,
          userId,
          requestId,
        );

        const unitCost = poItem.unitCost;
        await tx.goodsReceiptItem.update({
          where: {
            id: goodsReceipt.items.find(
              (gi) => gi.purchaseOrderItemId === item.purchaseOrderItemId,
            )!.id,
          },
          data: { unitCost },
        });
      }

      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: dto.purchaseOrderId },
      });
      const allReceived = updatedItems.every((i) => i.receivedQuantity >= i.quantity);
      const anyReceived = updatedItems.some((i) => i.receivedQuantity > 0);

      let newStatus: string;
      if (allReceived) newStatus = 'RECEIVED';
      else if (anyReceived) newStatus = 'PARTIALLY_RECEIVED';
      else newStatus = po.status;

      if (newStatus !== po.status) {
        await tx.purchaseOrder.update({
          where: { id: dto.purchaseOrderId },
          data: { status: newStatus as never },
        });
      }

      return goodsReceipt;
    });

    await this.log(
      orgId,
      userId,
      'goods_receipt.created',
      'CREATE',
      result.id,
      { grnNumber, purchaseOrderId: dto.purchaseOrderId, itemCount: dto.items.length },
      requestId,
    );
    return this.findOne(orgId, result.id);
  }

  async findAll(orgId: string, query: GoodsReceiptQueryDto) {
    const {
      search,
      status,
      purchaseOrderId,
      warehouseId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (warehouseId) where.warehouseId = warehouseId;
    if (search) {
      where.OR = [{ grnNumber: { contains: search, mode: 'insensitive' } }];
    }

    const [data, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          purchaseOrder: { select: { id: true, poNumber: true } },
          warehouse: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const gr = await this.prisma.goodsReceipt.findFirst({
      where: { id, organizationId: orgId },
      include: {
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
    if (!gr) throw new NotFoundException('Goods receipt not found');
    return gr;
  }

  async cancel(
    orgId: string,
    id: string,
    reason: string | null,
    userId: string,
    requestId: string,
  ) {
    const gr = await this.findOne(orgId, id);

    if (gr.status !== 'DRAFT') {
      throw new BadRequestException('Cannot cancel a receipt that has already been processed');
    }

    const updated = await this.prisma.goodsReceipt.update({
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
      'goods_receipt.cancelled',
      'UPDATE',
      id,
      { reason: reason || null },
      requestId,
    );
    return updated;
  }
}
