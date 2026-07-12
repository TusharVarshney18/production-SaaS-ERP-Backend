import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ReportQuery {
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  status?: string;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface AggregateResult {
  _sum: Record<string, number | null> | null;
}

interface GroupByItem {
  [key: string]: unknown;
  _sum?: Record<string, number | null>;
  _count?: Record<string, number>;
}

type PrismaAggregateModel = {
  aggregate: (args: {
    where?: Record<string, unknown>;
    _sum?: Record<string, boolean>;
  }) => Promise<AggregateResult>;
  groupBy: (args: Record<string, unknown>) => Promise<GroupByItem[]>;
};

@Injectable()
export class ReportEngineService {
  constructor(private readonly prisma: PrismaService) {}

  buildDateFilter(dateFrom?: string, dateTo?: string): Record<string, unknown> | undefined {
    if (!dateFrom && !dateTo) return undefined;
    const filter: Record<string, unknown> = {};
    if (dateFrom) filter.gte = new Date(dateFrom);
    if (dateTo) filter.lte = new Date(dateTo);
    return filter;
  }

  buildSearchFilter(
    search: string | undefined,
    fields: string[],
  ): Record<string, unknown>[] | undefined {
    if (!search) return undefined;
    return fields.map((field) => ({
      [field]: { contains: search, mode: 'insensitive' },
    }));
  }

  getPagination(page = 1, limit = 20): { skip: number; take: number; page: number; limit: number } {
    return { skip: (page - 1) * limit, take: limit, page, limit };
  }

  getOrderBy(sortBy = 'createdAt', sortOrder = 'desc'): Record<string, string> {
    return { [sortBy]: sortOrder };
  }

  async paginate<T>(
    query: Promise<[T[], number]>,
    pagination: { page: number; limit: number },
  ): Promise<PaginatedResult<T>> {
    const [data, total] = await query;
    const { page, limit } = pagination;
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getPeriodOverPeriod(
    orgId: string,
    currentStart: Date,
    currentEnd: Date,
    previousStart: Date,
    previousEnd: Date,
    model: string,
    sumField: string,
    dateField = 'createdAt',
  ): Promise<{
    current: number;
    previous: number;
    change: number;
    trend: 'up' | 'down' | 'neutral';
  }> {
    const m = this.prisma[model as keyof typeof this.prisma] as unknown as PrismaAggregateModel;
    const current = await m.aggregate({
      where: { organizationId: orgId, [dateField]: { gte: currentStart, lte: currentEnd } },
      _sum: { [sumField]: true },
    });
    const previous = await m.aggregate({
      where: { organizationId: orgId, [dateField]: { gte: previousStart, lte: previousEnd } },
      _sum: { [sumField]: true },
    });
    const currentVal = current._sum?.[sumField] || 0;
    const previousVal = previous._sum?.[sumField] || 0;
    const change =
      previousVal === 0 ? 100 : Math.round(((currentVal - previousVal) / previousVal) * 100);
    const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    return { current: currentVal, previous: previousVal, change, trend };
  }

  async getMonthlyTrend(
    orgId: string,
    year: number,
    model: string,
    sumField: string,
    dateField = 'createdAt',
  ): Promise<{ month: number; value: number }[]> {
    const m = this.prisma[model as keyof typeof this.prisma] as unknown as PrismaAggregateModel;
    const results: { month: number; value: number }[] = [];
    for (let month = 1; month <= 12; month++) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const agg = await m.aggregate({
        where: { organizationId: orgId, [dateField]: { gte: start, lte: end } },
        _sum: { [sumField]: true },
      });
      results.push({ month, value: agg._sum?.[sumField] || 0 });
    }
    return results;
  }

  async getGroupedSum(
    orgId: string,
    model: string,
    groupBy: string,
    sumField: string,
    dateFrom?: string,
    dateTo?: string,
    limit = 10,
  ): Promise<{ label: string; value: number }[]> {
    const m = this.prisma[model as keyof typeof this.prisma] as unknown as PrismaAggregateModel;
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
    }
    const results = await m.groupBy({
      by: [groupBy],
      where,
      _sum: { [sumField]: true },
      orderBy: { _sum: { [sumField]: 'desc' } },
      take: limit,
    });
    return results.map((r) => ({
      label: r[groupBy] as string,
      value: (r._sum?.[sumField] as number) || 0,
    }));
  }

  async getStatusDistribution(
    orgId: string,
    model: string,
    statusField: string,
  ): Promise<{ label: string; value: number }[]> {
    const m = this.prisma[model as keyof typeof this.prisma] as unknown as PrismaAggregateModel;
    const results = await m.groupBy({
      by: [statusField],
      where: { organizationId: orgId },
      _count: { id: true },
    });
    return results.map((r) => ({
      label: r[statusField] as string,
      value: (r._count?.id as number) || 0,
    }));
  }
}
