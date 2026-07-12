import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportEngineService, ReportQuery, PaginatedResult } from './report-engine.service';

@Injectable()
export class ProcurementReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ReportEngineService,
  ) {}

  async getPurchaseReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const orderBy = this.engine.getOrderBy(query.sortBy, query.sortOrder);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.createdAt = dateFilter;
    if (query.status) where.status = query.status;
    if (query.search) where.OR = this.engine.buildSearchFilter(query.search, ['poNumber', 'notes']);
    const dataPromise = this.prisma.purchaseOrder.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        vendor: { select: { companyName: true, vendorCode: true } },
        warehouse: { select: { name: true, code: true } },
        items: { include: { product: { select: { name: true, sku: true } } } },
      },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.purchaseOrder.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getPurchaseSpend(orgId: string, dateFrom?: string, dateTo?: string) {
    const where: Record<string, unknown> = {
      organizationId: orgId,
      status: { not: 'CANCELLED' as never },
    };
    if (dateFrom || dateTo) where.createdAt = this.engine.buildDateFilter(dateFrom, dateTo) || {};
    const result = await this.prisma.purchaseOrder.aggregate({ where, _sum: { grandTotal: true } });
    return result._sum.grandTotal || 0;
  }

  async getPurchaseTrend(orgId: string, year: number) {
    return this.engine.getMonthlyTrend(orgId, year, 'purchaseOrder', 'grandTotal');
  }

  async getVendorReport(orgId: string, query: ReportQuery) {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };
    if (query.search)
      where.OR = this.engine.buildSearchFilter(query.search, [
        'companyName',
        'vendorCode',
        'email',
      ]);
    const dataPromise = this.prisma.vendor.findMany({
      where,
      skip,
      take,
      orderBy: { companyName: 'asc' },
      include: { _count: { select: { purchaseOrders: true } } },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.vendor.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getPurchaseByStatus(orgId: string) {
    return this.engine.getStatusDistribution(orgId, 'purchaseOrder', 'status');
  }
}
