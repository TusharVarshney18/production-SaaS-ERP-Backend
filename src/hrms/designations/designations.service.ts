import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';

@Injectable()
export class DesignationsService {
  private readonly logger = new Logger(DesignationsService.name);
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
      resource: 'designation',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateDesignationDto, userId: string, requestId: string) {
    const existing = await this.prisma.designation.findFirst({
      where: { organizationId: orgId, code: dto.code },
    });
    if (existing) throw new ConflictException('Designation code already exists');
    const desig = await this.prisma.designation.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        code: dto.code,
        level: dto.level ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.log(
      orgId,
      userId,
      'designation.created',
      'CREATE',
      desig.id,
      { code: desig.code, name: desig.name },
      requestId,
    );
    return desig;
  }

  async findAll(orgId: string) {
    return this.prisma.designation.findMany({
      where: { organizationId: orgId },
      orderBy: { level: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(orgId: string, id: string) {
    const desig = await this.prisma.designation.findFirst({
      where: { id, organizationId: orgId },
      include: { _count: { select: { employees: true } } },
    });
    if (!desig) throw new NotFoundException('Designation not found');
    return desig;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateDesignationDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.level !== undefined) data.level = dto.level;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const desig = await this.prisma.designation.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'designation.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return desig;
  }
}
