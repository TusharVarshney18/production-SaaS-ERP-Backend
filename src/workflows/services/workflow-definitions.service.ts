import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

@Injectable()
export class WorkflowDefinitionsService {
  private readonly logger = new Logger(WorkflowDefinitionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async log(
    orgId: string,
    actorId: string,
    event: string,
    resourceId: string,
    details: Record<string, unknown>,
    requestId: string,
  ) {
    await this.auditLog.create({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      event,
      resource: 'workflow_definition',
      resourceId,
      action: event.split('.').pop()!,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(
    orgId: string,
    dto: {
      name: string;
      event: string;
      conditions?: Record<string, unknown>;
      isActive?: boolean;
      actions: { type: string; config: Record<string, unknown>; order: number }[];
    },
    userId: string,
    requestId: string,
  ) {
    const existing = await this.prisma.workflowDefinition.findFirst({
      where: { organizationId: orgId, name: dto.name },
    });
    if (existing) throw new ConflictException('Workflow name already exists');

    const workflow = await this.prisma.workflowDefinition.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        event: dto.event,
        conditions:
          dto.conditions !== undefined
            ? (dto.conditions as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        isActive: dto.isActive ?? true,
        actions: {
          create: dto.actions.map((a) => ({
            type: a.type as never,
            config: a.config as Prisma.InputJsonValue,
            order: a.order,
          })),
        },
      },
      include: { actions: { orderBy: { order: 'asc' } } },
    });
    await this.log(
      orgId,
      userId,
      'workflow.created',
      workflow.id,
      { name: workflow.name, event: workflow.event },
      requestId,
    );
    return workflow;
  }

  async findAll(orgId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      include: { actions: { orderBy: { order: 'asc' } }, _count: { select: { executions: true } } },
    });
  }

  async findOne(orgId: string, id: string) {
    const wf = await this.prisma.workflowDefinition.findFirst({
      where: { id, organizationId: orgId },
      include: { actions: { orderBy: { order: 'asc' } } },
    });
    if (!wf) throw new NotFoundException('Workflow definition not found');
    return wf;
  }

  async update(
    orgId: string,
    id: string,
    dto: {
      name?: string;
      event?: string;
      conditions?: Record<string, unknown> | null;
      isActive?: boolean;
    },
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.event !== undefined) data.event = dto.event;
    if (dto.conditions !== undefined) data.conditions = dto.conditions;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    const wf = await this.prisma.workflowDefinition.update({
      where: { id },
      data,
      include: { actions: { orderBy: { order: 'asc' } } },
    });
    await this.log(
      orgId,
      userId,
      'workflow.updated',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return wf;
  }

  async toggleActive(orgId: string, id: string, userId: string, requestId: string) {
    const wf = await this.findOne(orgId, id);
    const updated = await this.prisma.workflowDefinition.update({
      where: { id },
      data: { isActive: !wf.isActive },
    });
    await this.log(
      orgId,
      userId,
      `workflow.${updated.isActive ? 'activated' : 'deactivated'}`,
      id,
      { name: wf.name },
      requestId,
    );
    return updated;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.workflowDefinition.delete({ where: { id } });
    await this.log(orgId, userId, 'workflow.deleted', id, {}, requestId);
    return { message: 'Workflow deleted' };
  }

  async findByEvent(orgId: string, event: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { organizationId: orgId, event, isActive: true },
      include: { actions: { orderBy: { order: 'asc' } } },
    });
  }

  async getExecutionLogs(orgId: string, workflowId?: string, page = 1, limit = 50) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (workflowId) where.workflowDefinitionId = workflowId;
    const [data, total] = await Promise.all([
      this.prisma.workflowExecutionLog.findMany({
        where,
        orderBy: { triggeredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { workflowDefinition: { select: { id: true, name: true, event: true } } },
      }),
      this.prisma.workflowExecutionLog.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
