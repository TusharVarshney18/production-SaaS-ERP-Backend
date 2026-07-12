import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AssignActivityDto } from './dto/assign-activity.dto';
import { ChangeDueDateDto } from './dto/change-due-date.dto';
import { ChangePriorityDto } from './dto/change-priority.dto';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async recordTimeline(
    activityId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.activityTimeline.create({
      data: {
        activityId,
        event,
        description,
        details: details as Prisma.InputJsonValue,
        userId: userId || null,
      },
    });
  }

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
      resource: 'activity',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateActivityDto, userId: string, requestId: string) {
    const activity = await this.prisma.activity.create({
      data: {
        organizationId: orgId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        ownerId: userId,
        assignedToId: dto.assignedToId || null,
        type: dto.type as never,
        title: dto.title,
        description: dto.description || null,
        status: (dto.status as never) || 'PENDING',
        priority: (dto.priority as never) || 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      activity.id,
      'activity.created',
      `Activity created: ${activity.title}`,
      { activityId: activity.id },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'activity.created',
      'CREATE',
      activity.id,
      { title: activity.title, entityType: dto.entityType },
      requestId,
    );
    return activity;
  }

  async findAll(orgId: string, query: ActivityQueryDto) {
    const {
      search,
      entityType,
      entityId,
      ownerId,
      assignedToId,
      type,
      status,
      priority,
      isArchived,
      dueDateAfter,
      dueDateBefore,
      createdAfter,
      createdBefore,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (ownerId) where.ownerId = ownerId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (isArchived !== undefined) where.isArchived = isArchived;

    if (dueDateAfter || dueDateBefore) {
      const dueDate: Record<string, Date | string> = {};
      if (dueDateAfter) dueDate.gte = new Date(dueDateAfter);
      if (dueDateBefore) dueDate.lte = new Date(dueDateBefore);
      where.dueDate = dueDate;
    }

    if (createdAfter || createdBefore) {
      const createdAt: Record<string, Date | string> = {};
      if (createdAfter) createdAt.gte = new Date(createdAfter);
      if (createdBefore) createdAt.lte = new Date(createdBefore);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.activity.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const activity = await this.prisma.activity.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateActivityDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);

    const data: Record<string, unknown> = {};
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

    const activity = await this.prisma.activity.update({
      where: { id },
      data,
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'activity.updated',
      `Activity updated: ${activity.title}`,
      { changes: Object.keys(data) },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'activity.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return activity;
  }

  async complete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const activity = await this.prisma.activity.update({
      where: { id },
      data: { status: 'COMPLETED' as never, completedAt: new Date() },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(id, 'activity.completed', 'Activity completed', {}, userId);
    await this.log(orgId, userId, 'activity.completed', 'UPDATE', id, {}, requestId);
    return activity;
  }

  async cancel(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const activity = await this.prisma.activity.update({
      where: { id },
      data: { status: 'CANCELLED' as never },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(id, 'activity.cancelled', 'Activity cancelled', {}, userId);
    await this.log(orgId, userId, 'activity.cancelled', 'UPDATE', id, {}, requestId);
    return activity;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const activity = await this.prisma.activity.update({
      where: { id },
      data: { isArchived: true },
    });
    await this.recordTimeline(id, 'activity.archived', 'Activity archived', {}, userId);
    await this.log(orgId, userId, 'activity.archived', 'UPDATE', id, {}, requestId);
    return activity;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const activity = await this.prisma.activity.update({
      where: { id },
      data: { isArchived: false },
    });
    await this.recordTimeline(
      id,
      'activity.restored',
      'Activity restored from archive',
      {},
      userId,
    );
    await this.log(orgId, userId, 'activity.restored', 'UPDATE', id, {}, requestId);
    return activity;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.activity.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'activity.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Activity deleted' };
  }

  async assign(
    orgId: string,
    id: string,
    dto: AssignActivityDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findOne(orgId, id);
    const prevAssignee = existing.assignedToId;

    const activity = await this.prisma.activity.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'activity.assigned',
      `Activity assigned`,
      { from: prevAssignee, to: dto.assignedToId },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'activity.assigned',
      'UPDATE',
      id,
      { from: prevAssignee, to: dto.assignedToId },
      requestId,
    );
    return activity;
  }

  async changeDueDate(
    orgId: string,
    id: string,
    dto: ChangeDueDateDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findOne(orgId, id);
    const prevDate = existing.dueDate;

    const activity = await this.prisma.activity.update({
      where: { id },
      data: { dueDate: new Date(dto.dueDate) },
    });

    await this.recordTimeline(
      id,
      'activity.due_date_changed',
      `Due date changed`,
      { from: prevDate, to: dto.dueDate },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'activity.due_date_changed',
      'UPDATE',
      id,
      { from: prevDate, to: dto.dueDate },
      requestId,
    );
    return activity;
  }

  async changePriority(
    orgId: string,
    id: string,
    dto: ChangePriorityDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findOne(orgId, id);
    const prevPriority = existing.priority;

    const activity = await this.prisma.activity.update({
      where: { id },
      data: { priority: dto.priority as never },
    });

    await this.recordTimeline(
      id,
      'activity.priority_changed',
      `Priority changed from ${prevPriority} to ${dto.priority}`,
      { from: prevPriority, to: dto.priority },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'activity.priority_changed',
      'UPDATE',
      id,
      { from: prevPriority, to: dto.priority },
      requestId,
    );
    return activity;
  }

  async getTimeline(orgId: string, activityId: string, page = 1, limit = 50) {
    await this.findOne(orgId, activityId);
    const where = { activityId };
    const [data, total] = await Promise.all([
      this.prisma.activityTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.activityTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
