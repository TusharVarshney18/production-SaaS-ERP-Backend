import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportEngineService, ReportQuery, PaginatedResult } from './report-engine.service';

@Injectable()
export class HrReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ReportEngineService,
  ) {}

  async getEmployeeReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.search)
      where.OR = this.engine.buildSearchFilter(query.search, [
        'firstName',
        'lastName',
        'employeeCode',
        'email',
      ]);
    if (query.status) where.employmentStatus = query.status;
    const dataPromise = this.prisma.employee.findMany({
      where,
      skip,
      take,
      orderBy: { firstName: 'asc' },
      include: {
        department: { select: { name: true, code: true } },
        designation: { select: { name: true, code: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.employee.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getAttendanceReport(orgId: string, query: ReportQuery) {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.date = dateFilter;
    if (query.status) where.status = query.status;
    const dataPromise = this.prisma.attendance.findMany({
      where,
      skip,
      take,
      orderBy: { date: 'desc' },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.attendance.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getLeaveReport(orgId: string, query: ReportQuery) {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (query.status) where.status = query.status;
    if (query.search) where.leaveType = query.search;
    const dataPromise = this.prisma.leaveRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.leaveRequest.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getEmployeeCount(orgId: string) {
    return this.prisma.employee.count({
      where: { organizationId: orgId, employmentStatus: 'ACTIVE' as never },
    });
  }

  async getAttendanceRate(orgId: string, dateFrom?: string, dateTo?: string): Promise<number> {
    const dateFilter = this.engine.buildDateFilter(dateFrom, dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.date = dateFilter;
    const total = await this.prisma.attendance.count({ where });
    const present = await this.prisma.attendance.count({
      where: { ...where, status: 'PRESENT' as never },
    });
    return total === 0 ? 0 : Math.round((present / total) * 100);
  }

  async getLeaveRate(orgId: string, dateFrom?: string, dateTo?: string): Promise<number> {
    const dateFilter = this.engine.buildDateFilter(dateFrom, dateTo);
    const where: Record<string, unknown> = { organizationId: orgId, status: 'APPROVED' as never };
    if (dateFilter) where.createdAt = dateFilter;
    const count = await this.prisma.leaveRequest.count({ where: where as never });
    return count;
  }

  async getEmployeeByStatus(orgId: string) {
    return this.engine.getStatusDistribution(orgId, 'employee', 'employmentStatus');
  }

  async getEmployeeByDepartment(orgId: string) {
    const results = await this.prisma.employee.groupBy({
      by: ['departmentId'],
      where: { organizationId: orgId, employmentStatus: 'ACTIVE' as never },
      _count: { id: true },
    });
    const deptIds = results.map((r) => r.departmentId).filter(Boolean) as string[];
    const depts =
      deptIds.length > 0
        ? await this.prisma.department.findMany({
            where: { id: { in: deptIds } },
            select: { id: true, name: true },
          })
        : [];
    return results.map((r) => ({
      department: depts.find((d) => d.id === r.departmentId)?.name || 'Unassigned',
      count: r._count.id,
    }));
  }
}
