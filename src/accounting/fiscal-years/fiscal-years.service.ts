import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateFiscalYearDto } from './dto/create-fiscal-year.dto';
import { UpdateFiscalYearDto } from './dto/update-fiscal-year.dto';

@Injectable()
export class FiscalYearsService {
  private readonly logger = new Logger(FiscalYearsService.name);

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
      resource: 'fiscal_year',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateFiscalYearDto, userId: string, requestId: string) {
    const existing = await this.prisma.fiscalYear.findFirst({
      where: { organizationId: orgId, name: dto.name },
    });
    if (existing) throw new ConflictException('Fiscal year name already exists');

    const overlapping = await this.prisma.fiscalYear.findFirst({
      where: {
        organizationId: orgId,
        OR: [
          { startDate: { lte: new Date(dto.endDate) }, endDate: { gte: new Date(dto.startDate) } },
        ],
      },
    });
    if (overlapping) throw new ConflictException('Fiscal year dates overlap with existing year');

    const fiscalYear = await this.prisma.fiscalYear.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        ...(dto.periods
          ? {
              periods: {
                create: dto.periods.map((p) => ({
                  organizationId: orgId,
                  periodNumber: p.periodNumber,
                  startDate: new Date(p.startDate),
                  endDate: new Date(p.endDate),
                })),
              },
            }
          : {}),
      },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    });

    await this.log(
      orgId,
      userId,
      'fiscal_year.created',
      'CREATE',
      fiscalYear.id,
      { name: fiscalYear.name },
      requestId,
    );
    return fiscalYear;
  }

  async findAll(orgId: string) {
    return this.prisma.fiscalYear.findMany({
      where: { organizationId: orgId },
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { periods: true } } },
    });
  }

  async findOne(orgId: string, id: string) {
    const fy = await this.prisma.fiscalYear.findFirst({
      where: { id, organizationId: orgId },
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    });
    if (!fy) throw new NotFoundException('Fiscal year not found');
    return fy;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateFiscalYearDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);

    if (dto.name) {
      const existing = await this.prisma.fiscalYear.findFirst({
        where: { organizationId: orgId, name: dto.name, id: { not: id } },
      });
      if (existing) throw new ConflictException('Fiscal year name already exists');
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.isClosed !== undefined) data.isClosed = dto.isClosed;

    const fy = await this.prisma.fiscalYear.update({
      where: { id },
      data,
      include: { periods: { orderBy: { periodNumber: 'asc' } } },
    });
    await this.log(
      orgId,
      userId,
      'fiscal_year.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return fy;
  }

  async close(orgId: string, id: string, userId: string, requestId: string) {
    const fy = await this.findOne(orgId, id);
    if (fy.isClosed) throw new BadRequestException('Fiscal year already closed');

    const hasDraft = await this.prisma.journalEntry.count({
      where: {
        organizationId: orgId,
        status: 'DRAFT' as never,
        postingDate: { gte: fy.startDate, lte: fy.endDate },
      },
    });
    if (hasDraft > 0)
      throw new BadRequestException('Cannot close fiscal year with draft journal entries');

    await this.prisma.accountingPeriod.updateMany({
      where: { fiscalYearId: id },
      data: { isClosed: true },
    });

    const result = await this.prisma.fiscalYear.update({
      where: { id },
      data: { isClosed: true },
    });

    await this.log(orgId, userId, 'fiscal_year.closed', 'UPDATE', id, { name: fy.name }, requestId);
    return result;
  }
}
