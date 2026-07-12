import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportEngineService, ReportQuery, PaginatedResult } from './report-engine.service';

@Injectable()
export class SalesReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ReportEngineService,
  ) {}

  async getSalesReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const orderBy = this.engine.getOrderBy(query.sortBy, query.sortOrder);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.createdAt = dateFilter;
    if (query.status) where.status = query.status;
    if (query.search)
      where.OR = this.engine.buildSearchFilter(query.search, ['orderNumber', 'notes']);
    const dataPromise = this.prisma.salesOrder.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        company: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.salesOrder.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getRevenueKpi(orgId: string, dateFrom?: string, dateTo?: string) {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      status: { not: 'CANCELLED' as never },
    };
    if (dateFrom || dateTo) where.createdAt = this.engine.buildDateFilter(dateFrom, dateTo) || {};
    const result = await this.prisma.salesOrder.aggregate({ where, _sum: { grandTotal: true } });
    return result._sum.grandTotal || 0;
  }

  async getRevenueTrend(orgId: string, year: number) {
    return this.engine.getMonthlyTrend(orgId, year, 'salesOrder', 'grandTotal');
  }

  async getSalesByStatus(orgId: string) {
    return this.engine.getStatusDistribution(orgId, 'salesOrder', 'status');
  }

  async getTopProducts(orgId: string, dateFrom?: string, dateTo?: string, limit = 10) {
    const where: Record<string, unknown> = { salesOrder: { organizationId: orgId } };
    if (dateFrom || dateTo) {
      where.salesOrder = {
        ...(where.salesOrder as Record<string, unknown>),
        createdAt: this.engine.buildDateFilter(dateFrom, dateTo),
      };
    }
    const results = await this.prisma.salesOrderItem.groupBy({
      by: ['productId'],
      where: where as never,
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
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
        totalQty: r._sum.quantity || 0,
        totalRevenue: r._sum.lineTotal || 0,
      };
    });
  }

  async getQuotationReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const orderBy = this.engine.getOrderBy(query.sortBy, query.sortOrder);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.createdAt = dateFilter;
    if (query.status) where.status = query.status;
    const dataPromise = this.prisma.quotation.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { company: { select: { name: true } }, items: true },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.quotation.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getCustomerReport(orgId: string, query: ReportQuery) {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.search)
      where.OR = this.engine.buildSearchFilter(query.search, ['name', 'email', 'phone']);
    const dataPromise = this.prisma.company.findMany({
      where,
      skip,
      take,
      orderBy: { name: 'asc' },
      include: { _count: { select: { salesOrders: true, quotations: true } } },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.company.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }
}
