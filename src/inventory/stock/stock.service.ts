import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ReserveStockDto } from './dto/reserve-stock.dto';
import { ReleaseStockDto } from './dto/release-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockQueryDto } from './dto/stock-query.dto';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

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
      resource: 'stock',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async createLedgerEntry(
    orgId: string,
    warehouseId: string,
    productId: string,
    transactionType:
      | 'PURCHASE'
      | 'SALE'
      | 'TRANSFER_IN'
      | 'TRANSFER_OUT'
      | 'ADJUSTMENT'
      | 'RETURN'
      | 'RESERVATION'
      | 'RELEASE',
    referenceType: string,
    referenceId: string | null,
    quantity: number,
    previousQty: number,
    newQty: number,
    createdBy: string,
  ) {
    return this.prisma.stockLedger.create({
      data: {
        organizationId: orgId,
        warehouseId,
        productId,
        transactionType,
        referenceType,
        referenceId,
        quantity,
        previousQty,
        newQty,
        createdBy,
      },
    });
  }

  async getStock(orgId: string, warehouseId: string, productId: string) {
    const stock = await this.prisma.stock.findFirst({
      where: { organizationId: orgId, warehouseId, productId },
    });
    if (!stock) {
      return {
        id: null,
        organizationId: orgId,
        warehouseId,
        productId,
        availableQty: 0,
        reservedQty: 0,
        damagedQty: 0,
        reorderLevel: 0,
        maxLevel: 0,
      };
    }
    return stock;
  }

  private async getOrCreateStock(orgId: string, warehouseId: string, productId: string) {
    let stock = await this.prisma.stock.findFirst({
      where: { organizationId: orgId, warehouseId, productId },
    });

    if (!stock) {
      stock = await this.prisma.stock.create({
        data: {
          organizationId: orgId,
          warehouseId,
          productId,
          availableQty: 0,
          reservedQty: 0,
          damagedQty: 0,
          reorderLevel: 0,
          maxLevel: 0,
        },
      });
    }

    return stock;
  }

  async findAll(orgId: string, query: StockQueryDto) {
    const {
      warehouseId,
      productId,
      search,
      lowStock,
      outOfStock,
      reserved,
      page = 1,
      limit = 20,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };

    if (warehouseId) where.warehouseId = warehouseId;
    if (productId) where.productId = productId;

    const productWhere: Record<string, unknown> = {};
    if (search) {
      productWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    const filterConditions: Record<string, unknown>[] = [];

    if (outOfStock) {
      filterConditions.push({ availableQty: 0 });
    }
    if (reserved) {
      filterConditions.push({ reservedQty: { gt: 0 } });
    }

    type StockWhere = Record<string, unknown> & {
      product?: Record<string, unknown>;
      AND?: Record<string, unknown>[];
    };

    const baseWhere: StockWhere = {
      ...where,
      ...(Object.keys(productWhere).length > 0 ? { product: productWhere } : {}),
      ...(filterConditions.length > 0 ? { AND: filterConditions } : {}),
    };

    if (lowStock) {
      const allMatching = await this.prisma.stock.findMany({
        where: baseWhere as never,
        select: { id: true, availableQty: true, reorderLevel: true },
      });
      const lowStockIds = allMatching
        .filter((s) => s.availableQty > 0 && s.availableQty <= s.reorderLevel)
        .map((s) => s.id);

      const [data, total] = await Promise.all([
        this.prisma.stock.findMany({
          where: { id: { in: lowStockIds }, ...baseWhere } as never,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            product: { select: { id: true, name: true, sku: true, barcode: true } },
            warehouse: { select: { id: true, name: true, code: true } },
          },
        }),
        Promise.resolve(lowStockIds.length),
      ]);
      return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
    }

    const [data, total] = await Promise.all([
      this.prisma.stock.findMany({
        where: baseWhere as never,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true, barcode: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stock.count({ where: baseWhere as never }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getStockLedger(
    orgId: string,
    warehouseId?: string,
    productId?: string,
    page = 1,
    limit = 50,
  ) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (warehouseId) where.warehouseId = warehouseId;
    if (productId) where.productId = productId;

    const [data, total] = await Promise.all([
      this.prisma.stockLedger.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.stockLedger.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async reserve(orgId: string, dto: ReserveStockDto, userId: string, requestId: string) {
    const stock = await this.getOrCreateStock(orgId, dto.warehouseId, dto.productId);
    const previousAvailable = stock.availableQty;

    if (stock.availableQty < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${stock.availableQty}, Requested: ${dto.quantity}`,
      );
    }

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: {
        availableQty: { decrement: dto.quantity },
        reservedQty: { increment: dto.quantity },
      },
    });

    await this.createLedgerEntry(
      orgId,
      dto.warehouseId,
      dto.productId,
      'RESERVATION',
      dto.referenceType,
      dto.referenceId,
      -dto.quantity,
      previousAvailable,
      updated.availableQty,
      userId,
    );

    await this.log(
      orgId,
      userId,
      'stock.reserved',
      'UPDATE',
      stock.id,
      {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantity: dto.quantity,
        reference: `${dto.referenceType}:${dto.referenceId}`,
      },
      requestId,
    );

    return updated;
  }

  async release(orgId: string, dto: ReleaseStockDto, userId: string, requestId: string) {
    const stock = await this.getOrCreateStock(orgId, dto.warehouseId, dto.productId);
    const previousAvailable = stock.availableQty;

    if (stock.reservedQty < dto.quantity) {
      throw new BadRequestException(
        `Insufficient reserved stock. Reserved: ${stock.reservedQty}, Requested: ${dto.quantity}`,
      );
    }

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: {
        availableQty: { increment: dto.quantity },
        reservedQty: { decrement: dto.quantity },
      },
    });

    await this.createLedgerEntry(
      orgId,
      dto.warehouseId,
      dto.productId,
      'RELEASE',
      dto.referenceType,
      dto.referenceId,
      dto.quantity,
      previousAvailable,
      updated.availableQty,
      userId,
    );

    await this.log(
      orgId,
      userId,
      'stock.released',
      'UPDATE',
      stock.id,
      {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        quantity: dto.quantity,
        reference: `${dto.referenceType}:${dto.referenceId}`,
      },
      requestId,
    );

    return updated;
  }

  async increase(
    orgId: string,
    warehouseId: string,
    productId: string,
    quantity: number,
    referenceType: string,
    referenceId: string | null,
    userId: string,
    requestId: string,
  ) {
    const stock = await this.getOrCreateStock(orgId, warehouseId, productId);
    const previousAvailable = stock.availableQty;

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: { availableQty: { increment: quantity } },
    });

    await this.createLedgerEntry(
      orgId,
      warehouseId,
      productId,
      'PURCHASE',
      referenceType,
      referenceId,
      quantity,
      previousAvailable,
      updated.availableQty,
      userId,
    );

    await this.log(
      orgId,
      userId,
      'stock.increased',
      'UPDATE',
      stock.id,
      {
        warehouseId,
        productId,
        quantity,
        reference: `${referenceType}:${referenceId}`,
      },
      requestId,
    );

    return updated;
  }

  async decrease(
    orgId: string,
    warehouseId: string,
    productId: string,
    quantity: number,
    referenceType: string,
    referenceId: string | null,
    userId: string,
    requestId: string,
  ) {
    const stock = await this.getOrCreateStock(orgId, warehouseId, productId);
    const previousAvailable = stock.availableQty;

    if (stock.availableQty < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${stock.availableQty}, Requested: ${quantity}`,
      );
    }

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: { availableQty: { decrement: quantity } },
    });

    await this.createLedgerEntry(
      orgId,
      warehouseId,
      productId,
      'SALE',
      referenceType,
      referenceId,
      -quantity,
      previousAvailable,
      updated.availableQty,
      userId,
    );

    await this.log(
      orgId,
      userId,
      'stock.decreased',
      'UPDATE',
      stock.id,
      {
        warehouseId,
        productId,
        quantity,
        reference: `${referenceType}:${referenceId}`,
      },
      requestId,
    );

    return updated;
  }

  async adjust(orgId: string, dto: AdjustStockDto, userId: string, requestId: string) {
    const stock = await this.getOrCreateStock(orgId, dto.warehouseId, dto.productId);
    const previousAvailable = stock.availableQty;
    const newAvailable = stock.availableQty + dto.quantity;

    if (newAvailable < 0) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${stock.availableQty}, Adjustment: ${dto.quantity}`,
      );
    }

    const updated = await this.prisma.stock.update({
      where: { id: stock.id },
      data: { availableQty: newAvailable },
    });

    await this.createLedgerEntry(
      orgId,
      dto.warehouseId,
      dto.productId,
      'ADJUSTMENT',
      'Manual',
      null,
      dto.quantity,
      previousAvailable,
      newAvailable,
      userId,
    );

    await this.log(
      orgId,
      userId,
      'stock.adjusted',
      'UPDATE',
      stock.id,
      {
        warehouseId: dto.warehouseId,
        productId: dto.productId,
        previousQty: previousAvailable,
        newQty: newAvailable,
        reason: dto.reason || null,
      },
      requestId,
    );

    return updated;
  }

  async transferStock(
    orgId: string,
    fromWarehouseId: string,
    toWarehouseId: string,
    productId: string,
    quantity: number,
    transferId: string,
    userId: string,
  ) {
    const fromStock = await this.getOrCreateStock(orgId, fromWarehouseId, productId);
    const toStock = await this.getOrCreateStock(orgId, toWarehouseId, productId);

    if (fromStock.availableQty < quantity) {
      throw new BadRequestException(
        `Insufficient stock in source warehouse. Available: ${fromStock.availableQty}, Requested: ${quantity}`,
      );
    }

    const [updatedFrom] = await Promise.all([
      this.prisma.stock.update({
        where: { id: fromStock.id },
        data: { availableQty: { decrement: quantity } },
      }),
      this.prisma.stock.update({
        where: { id: toStock.id },
        data: { availableQty: { increment: quantity } },
      }),
    ]);

    const updatedTo = await this.prisma.stock.findFirst({
      where: { organizationId: orgId, warehouseId: toWarehouseId, productId },
    });

    await this.createLedgerEntry(
      orgId,
      fromWarehouseId,
      productId,
      'TRANSFER_OUT',
      'Transfer',
      transferId,
      -quantity,
      fromStock.availableQty,
      updatedFrom.availableQty,
      userId,
    );

    await this.createLedgerEntry(
      orgId,
      toWarehouseId,
      productId,
      'TRANSFER_IN',
      'Transfer',
      transferId,
      quantity,
      toStock.availableQty,
      updatedTo!.availableQty,
      userId,
    );

    return { from: updatedFrom, to: updatedTo };
  }
}
