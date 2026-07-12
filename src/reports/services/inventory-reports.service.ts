import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportEngineService, ReportQuery, PaginatedResult } from './report-engine.service';

@Injectable()
export class InventoryReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ReportEngineService,
  ) {}

  async getInventoryReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const orderBy = this.engine.getOrderBy(query.sortBy || 'updatedAt', query.sortOrder);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.search)
      where.product = { OR: this.engine.buildSearchFilter(query.search, ['name', 'sku']) };
    if (query.status === 'low_stock')
      where.AND = [{ availableQty: { gt: 0 } }, { availableQty: { lte: 10 } }];
    if (query.status === 'out_of_stock') where.availableQty = 0;
    if (query.status === 'reserved') where.reservedQty = { gt: 0 };

    const allData = await this.prisma.stock.findMany({
      where: where as never,
      orderBy,
      skip,
      take,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
    const total = await this.prisma.stock.count({ where: where as never });

    const data =
      query.status !== 'low_stock'
        ? allData
        : allData.filter((s) => s.availableQty > 0 && s.availableQty <= s.reorderLevel);
    const finalTotal = query.status === 'low_stock' ? data.length : total;
    return {
      data: data as unknown as Record<string, unknown>[],
      meta: { total: finalTotal, page, limit, totalPages: Math.ceil(finalTotal / limit) },
    };
  }

  async getInventoryValue(orgId: string): Promise<number> {
    const stock = await this.prisma.stock.findMany({
      where: { organizationId: orgId },
      select: { availableQty: true, product: { select: { purchasePrice: true } } },
    });
    return stock.reduce((sum, s) => sum + s.availableQty * (s.product?.purchasePrice || 0), 0);
  }

  async getStockMovementReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.createdAt = dateFilter;
    const dataPromise = this.prisma.stockLedger.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true, code: true } },
      },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.stockLedger.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getWarehouseReport(orgId: string): Promise<Record<string, unknown>[]> {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { organizationId: orgId, deletedAt: null },
      include: { _count: { select: { stock: true } } },
    });
    const warehouseIds = warehouses.map((w) => w.id);
    const stockAggs = await this.prisma.stock.groupBy({
      by: ['warehouseId'],
      where: { warehouseId: { in: warehouseIds } },
      _sum: { availableQty: true, reservedQty: true },
    });
    return warehouses.map((w) => {
      const agg = stockAggs.find((s) => s.warehouseId === w.id);
      return {
        id: w.id,
        name: w.name,
        code: w.code,
        status: w.status,
        totalProducts: w._count.stock,
        totalStock: agg?._sum.availableQty || 0,
        totalReserved: agg?._sum.reservedQty || 0,
      };
    });
  }

  async getTopMovingProducts(orgId: string, limit = 10) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const results = await this.prisma.stockLedger.groupBy({
      by: ['productId'],
      where: {
        organizationId: orgId,
        transactionType: 'SALE' as never,
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    });
    const productIds = results.map((r) => r.productId);
    const products =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, sku: true },
          })
        : [];
    return results.map((r) => {
      const product = products.find((p) => p.id === r.productId);
      return {
        productId: r.productId,
        productName: product?.name || 'Unknown',
        sku: product?.sku || '',
        totalSold: Math.abs(r._sum.quantity || 0),
      };
    });
  }
}
