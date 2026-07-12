import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);
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
      resource: 'department',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateDepartmentDto, userId: string, requestId: string) {
    const existing = await this.prisma.department.findFirst({
      where: { organizationId: orgId, code: dto.code },
    });
    if (existing) throw new ConflictException('Department code already exists');
    const dept = await this.prisma.department.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        code: dto.code,
        description: dto.description || null,
        isActive: dto.isActive ?? true,
      },
    });
    await this.log(
      orgId,
      userId,
      'department.created',
      'CREATE',
      dept.id,
      { code: dept.code, name: dept.name },
      requestId,
    );
    return dept;
  }

  async findAll(orgId: string) {
    return this.prisma.department.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(orgId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { employees: true } } },
    });
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateDepartmentDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const dept = await this.prisma.department.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'department.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return dept;
  }
}
