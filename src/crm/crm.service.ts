import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { CreateLeadNoteDto } from './dto/create-lead-note.dto';
import { UpdateLeadNoteDto } from './dto/update-lead-note.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async recordTimeline(
    leadId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.leadTimeline.create({
      data: {
        leadId,
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
      resource: 'lead',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  // ─── Leads ──────────────────────────────

  async create(orgId: string, dto: CreateLeadDto, userId: string, requestId: string) {
    const lead = await this.prisma.lead.create({
      data: {
        organizationId: orgId,
        ownerId: userId,
        assignedToId: dto.assignedToId || userId,
        companyName: dto.companyName || null,
        contactName: dto.contactName,
        email: dto.email || null,
        phone: dto.phone || null,
        website: dto.website || null,
        status: (dto.status as never) || 'NEW',
        source: (dto.source as never) || 'OTHER',
        priority: (dto.priority as never) || 'MEDIUM',
        estimatedValue: dto.estimatedValue ?? 0,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
        description: dto.description || null,
        tags: dto.tags?.length
          ? { create: dto.tags.map((t) => ({ name: t, color: '#6366f1' })) }
          : undefined,
      },
      include: { tags: true },
    });

    await this.recordTimeline(
      lead.id,
      'lead.created',
      `Lead created: ${lead.contactName}`,
      { leadId: lead.id },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'lead.created',
      'CREATE',
      lead.id,
      { contactName: lead.contactName },
      requestId,
    );

    return lead;
  }

  async findAll(orgId: string, query: LeadQueryDto) {
    const {
      search,
      ownerId,
      assignedToId,
      status,
      source,
      priority,
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
        { contactName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (ownerId) where.ownerId = ownerId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (status) where.status = status;
    if (source) where.source = source;
    if (priority) where.priority = priority;
    if (createdAfter || createdBefore) {
      const createdAt: Record<string, Date | string> = {};
      if (createdAfter) createdAt.gte = new Date(createdAfter);
      if (createdBefore) createdAt.lte = new Date(createdBefore);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          tags: true,
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { notes: true, activities: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        tags: true,
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
        notes: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        activities: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
        },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) throw new NotFoundException('Lead not found');
    return lead;
  }

  async update(orgId: string, id: string, dto: UpdateLeadDto, userId: string, requestId: string) {
    const existing = await this.findOne(orgId, id);
    const prevStatus = existing.status;

    const data: Record<string, unknown> = {};
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.contactName !== undefined) data.contactName = dto.contactName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.source !== undefined) data.source = dto.source;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.estimatedValue !== undefined) data.estimatedValue = dto.estimatedValue;
    if (dto.expectedCloseDate !== undefined)
      data.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
    if (dto.assignedToId !== undefined) data.assignedToId = dto.assignedToId;

    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...data,
        tags:
          dto.tags !== undefined
            ? { deleteMany: {}, create: dto.tags.map((t) => ({ name: t, color: '#6366f1' })) }
            : undefined,
      },
      include: { tags: true },
    });

    if (dto.status && dto.status !== prevStatus) {
      await this.recordTimeline(
        id,
        'lead.status_changed',
        `Status changed from ${prevStatus} to ${dto.status}`,
        { from: prevStatus, to: dto.status },
        userId,
      );
    } else {
      await this.recordTimeline(
        id,
        'lead.updated',
        `Lead updated: ${lead.contactName}`,
        {},
        userId,
      );
    }

    await this.log(
      orgId,
      userId,
      'lead.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return lead;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const lead = await this.prisma.lead.update({ where: { id }, data: { isArchived: true } });
    await this.recordTimeline(id, 'lead.archived', 'Lead archived', {}, userId);
    await this.log(orgId, userId, 'lead.archived', 'UPDATE', id, {}, requestId);
    return lead;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const lead = await this.prisma.lead.update({ where: { id }, data: { isArchived: false } });
    await this.recordTimeline(id, 'lead.restored', 'Lead restored from archive', {}, userId);
    await this.log(orgId, userId, 'lead.restored', 'UPDATE', id, {}, requestId);
    return lead;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.lead.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'lead.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Lead deleted' };
  }

  async assign(orgId: string, id: string, dto: AssignLeadDto, userId: string, requestId: string) {
    const existing = await this.findOne(orgId, id);
    const prevAssignee = existing.assignedToId;

    await this.prisma.leadAssignmentHistory.create({
      data: {
        leadId: id,
        fromUserId: prevAssignee || undefined,
        toUserId: dto.assignedToId,
        reason: dto.reason || null,
        assignedByUserId: userId,
      },
    });

    const lead = await this.prisma.lead.update({
      where: { id },
      data: { assignedToId: dto.assignedToId },
      include: {
        assignedTo: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const assigneeName = lead.assignedTo
      ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
      : 'unassigned';
    await this.recordTimeline(
      id,
      'lead.assigned',
      `Lead assigned to ${assigneeName}`,
      { from: prevAssignee, to: dto.assignedToId },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'lead.assigned',
      'UPDATE',
      id,
      { from: prevAssignee, to: dto.assignedToId },
      requestId,
    );

    return lead;
  }

  // ─── Notes ──────────────────────────────

  async createNote(
    orgId: string,
    leadId: string,
    dto: CreateLeadNoteDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, leadId);
    const note = await this.prisma.leadNote.create({
      data: { leadId, content: dto.content, userId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    await this.recordTimeline(leadId, 'note.added', 'Note added', { noteId: note.id }, userId);
    await this.log(
      orgId,
      userId,
      'lead.note.created',
      'CREATE',
      leadId,
      { noteId: note.id },
      requestId,
    );
    return note;
  }

  async updateNote(
    orgId: string,
    leadId: string,
    noteId: string,
    dto: UpdateLeadNoteDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, leadId);
    const note = await this.prisma.leadNote.findFirst({
      where: { id: noteId, leadId, deletedAt: null },
    });
    if (!note) throw new NotFoundException('Note not found');
    const updated = await this.prisma.leadNote.update({
      where: { id: noteId },
      data: { content: dto.content },
    });
    await this.log(orgId, userId, 'lead.note.updated', 'UPDATE', leadId, { noteId }, requestId);
    return updated;
  }

  async deleteNote(
    orgId: string,
    leadId: string,
    noteId: string,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, leadId);
    const note = await this.prisma.leadNote.findFirst({
      where: { id: noteId, leadId, deletedAt: null },
    });
    if (!note) throw new NotFoundException('Note not found');
    await this.prisma.leadNote.update({
      where: { id: noteId },
      data: { deletedAt: new Date(), deletedByUserId: userId },
    });
    await this.log(orgId, userId, 'lead.note.deleted', 'DELETE', leadId, { noteId }, requestId);
    return { message: 'Note deleted' };
  }

  async listNotes(orgId: string, leadId: string, page = 1, limit = 50) {
    await this.findOne(orgId, leadId);
    const where = { leadId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.leadNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.leadNote.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Activities ─────────────────────────

  async createActivity(
    orgId: string,
    leadId: string,
    dto: CreateLeadActivityDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, leadId);
    const activity = await this.prisma.leadActivity.create({
      data: {
        leadId,
        type: dto.type as never,
        subject: dto.subject,
        description: dto.description || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        isCompleted: dto.isCompleted ?? false,
        userId,
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    await this.recordTimeline(
      leadId,
      'activity.created',
      `Activity created: ${dto.type} - ${dto.subject}`,
      { activityId: activity.id, type: dto.type },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'lead.activity.created',
      'CREATE',
      leadId,
      { activityId: activity.id, type: dto.type },
      requestId,
    );
    return activity;
  }

  async listActivities(orgId: string, leadId: string, page = 1, limit = 50) {
    await this.findOne(orgId, leadId);
    const where = { leadId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.leadActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.leadActivity.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Timeline ───────────────────────────

  async getTimeline(orgId: string, leadId: string, page = 1, limit = 50) {
    await this.findOne(orgId, leadId);
    const where = { leadId };
    const [data, total] = await Promise.all([
      this.prisma.leadTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.leadTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Assignment History ─────────────────

  async getAssignmentHistory(orgId: string, leadId: string) {
    await this.findOne(orgId, leadId);
    return this.prisma.leadAssignmentHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
  }
}
