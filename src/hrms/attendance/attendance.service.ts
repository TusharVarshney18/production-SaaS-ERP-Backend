import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);
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
      resource: 'attendance',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async checkIn(orgId: string, dto: CheckInDto, userId: string, requestId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: orgId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existing = await this.prisma.attendance.findFirst({
      where: {
        employeeId: dto.employeeId,
        date: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
    });
    if (existing) throw new BadRequestException('Already checked in today');

    const checkInTime = dto.checkIn ? new Date(dto.checkIn) : new Date();
    const record = await this.prisma.attendance.create({
      data: {
        employeeId: dto.employeeId,
        organizationId: orgId,
        date: today,
        checkIn: checkInTime,
        status: 'PRESENT' as never,
      },
    });
    await this.log(
      orgId,
      userId,
      'attendance.check_in',
      'CREATE',
      record.id,
      { employeeId: dto.employeeId },
      requestId,
    );
    return record;
  }

  async checkOut(orgId: string, dto: CheckOutDto, userId: string, requestId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await this.prisma.attendance.findFirst({
      where: {
        employeeId: dto.employeeId,
        date: { gte: today, lt: new Date(today.getTime() + 86400000) },
      },
    });
    if (!record) throw new BadRequestException('No check-in record found for today');
    if (record.checkOut) throw new BadRequestException('Already checked out today');

    const checkOutTime = dto.checkOut ? new Date(dto.checkOut) : new Date();
    const updated = await this.prisma.attendance.update({
      where: { id: record.id },
      data: { checkOut: checkOutTime },
    });
    await this.log(
      orgId,
      userId,
      'attendance.check_out',
      'UPDATE',
      record.id,
      { employeeId: dto.employeeId },
      requestId,
    );
    return updated;
  }

  async findAll(orgId: string, query: AttendanceQueryDto) {
    const { employeeId, status, dateFrom, dateTo, page = 1, limit = 50 } = query;
    const where: Record<string, unknown> = { organizationId: orgId };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      this.prisma.attendance.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
