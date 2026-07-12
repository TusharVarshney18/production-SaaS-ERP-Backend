import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);
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
      resource: 'leave',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async apply(orgId: string, dto: ApplyLeaveDto, userId: string, requestId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, organizationId: orgId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) throw new BadRequestException('End date cannot be before start date');

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'APPROVED'] as never[] },
        OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
      },
    });
    if (overlapping) throw new BadRequestException('Overlapping leave request exists');

    const leave = await this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        organizationId: orgId,
        leaveType: dto.leaveType as never,
        startDate,
        endDate,
        reason: dto.reason || null,
      },
    });
    await this.log(
      orgId,
      userId,
      'leave.applied',
      'CREATE',
      leave.id,
      {
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        days: Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000) + 1,
      },
      requestId,
    );
    return leave;
  }

  async findAll(orgId: string, query: LeaveQueryDto) {
    const { employeeId, status, leaveType, page = 1, limit = 20 } = query;
    const where: Record<string, unknown> = { organizationId: orgId };
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    if (leaveType) where.leaveType = leaveType;

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
        },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const leave = await this.prisma.leaveRequest.findFirst({
      where: { id, organizationId: orgId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
            departmentId: true,
          },
        },
      },
    });
    if (!leave) throw new NotFoundException('Leave request not found');
    return leave;
  }

  async approve(orgId: string, id: string, userId: string, requestId: string) {
    const leave = await this.findOne(orgId, id);
    if (leave.status !== 'PENDING')
      throw new BadRequestException(`Cannot approve leave in status: ${leave.status}`);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });
    await this.log(
      orgId,
      userId,
      'leave.approved',
      'UPDATE',
      id,
      { employeeId: leave.employeeId, leaveType: leave.leaveType },
      requestId,
    );
    return updated;
  }

  async reject(
    orgId: string,
    id: string,
    reason: string | null,
    userId: string,
    requestId: string,
  ) {
    const leave = await this.findOne(orgId, id);
    if (leave.status !== 'PENDING')
      throw new BadRequestException(`Cannot reject leave in status: ${leave.status}`);

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectedBy: userId,
        rejectionReason: reason || null,
        rejectedAt: new Date(),
      },
    });
    await this.log(
      orgId,
      userId,
      'leave.rejected',
      'UPDATE',
      id,
      { employeeId: leave.employeeId, reason: reason || null },
      requestId,
    );
    return updated;
  }
}
