import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { StockService } from '../stock/stock.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';

@Injectable()
export class TransferService {
  private readonly logger = new Logger(TransferService.name);

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
      resource: 'inventory_transfer',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateTransferDto, userId: string, requestId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    const [fromWarehouse, toWarehouse] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.fromWarehouseId, organizationId: orgId, deletedAt: null },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: dto.toWarehouseId, organizationId: orgId, deletedAt: null },
      }),
    ]);

    if (!fromWarehouse) throw new NotFoundException('Source warehouse not found');
    if (!toWarehouse) throw new NotFoundException('Destination warehouse not found');

    const transfer = await this.prisma.inventoryTransfer.create({
      data: {
        organizationId: orgId,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        notes: dto.notes || null,
        createdBy: userId,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    await this.log(
      orgId,
      userId,
      'transfer.created',
      'CREATE',
      transfer.id,
      {
        fromWarehouse: dto.fromWarehouseId,
        toWarehouse: dto.toWarehouseId,
        itemCount: dto.items.length,
      },
      requestId,
    );

    return transfer;
  }

  async findAll(orgId: string, query: TransferQueryDto) {
    const {
      status,
      fromWarehouseId,
      toWarehouseId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (fromWarehouseId) where.fromWarehouseId = fromWarehouseId;
    if (toWarehouseId) where.toWarehouseId = toWarehouseId;

    const [data, total] = await Promise.all([
      this.prisma.inventoryTransfer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          fromWarehouse: { select: { id: true, name: true, code: true } },
          toWarehouse: { select: { id: true, name: true, code: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
        },
      }),
      this.prisma.inventoryTransfer.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const transfer = await this.prisma.inventoryTransfer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }

  async approve(orgId: string, id: string, userId: string, requestId: string) {
    const transfer = await this.findOne(orgId, id);

    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot approve transfer in status: ${transfer.status}`);
    }

    const updated = await this.prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: 'IN_TRANSIT',
        approvedBy: userId,
      },
      include: { items: true },
    });

    await this.log(
      orgId,
      userId,
      'transfer.approved',
      'UPDATE',
      id,
      {
        fromWarehouse: transfer.fromWarehouseId,
        toWarehouse: transfer.toWarehouseId,
      },
      requestId,
    );

    return updated;
  }

  async complete(orgId: string, id: string, userId: string, requestId: string) {
    const transfer = await this.findOne(orgId, id);

    if (transfer.status !== 'IN_TRANSIT') {
      throw new BadRequestException(`Cannot complete transfer in status: ${transfer.status}`);
    }

    const items = await this.prisma.inventoryTransferItem.findMany({
      where: { transferId: id },
    });

    for (const item of items) {
      await this.stock.transferStock(
        orgId,
        transfer.fromWarehouseId,
        transfer.toWarehouseId,
        item.productId,
        item.quantity,
        id,
        userId,
      );
    }

    const updated = await this.prisma.inventoryTransfer.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedBy: userId,
        completedAt: new Date(),
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
      },
    });

    await this.log(
      orgId,
      userId,
      'transfer.completed',
      'UPDATE',
      id,
      {
        fromWarehouse: transfer.fromWarehouseId,
        toWarehouse: transfer.toWarehouseId,
        itemCount: items.length,
      },
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
    const transfer = await this.findOne(orgId, id);

    if (transfer.status === 'COMPLETED' || transfer.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot cancel transfer in status: ${transfer.status}`);
    }

    const updated = await this.prisma.inventoryTransfer.update({
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
      'transfer.cancelled',
      'UPDATE',
      id,
      {
        reason: reason || null,
        previousStatus: transfer.status,
      },
      requestId,
    );

    return updated;
  }
}
