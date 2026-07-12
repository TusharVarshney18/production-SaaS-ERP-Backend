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
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';

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

  // ─── Company Helpers ─────────────────────

  private async recordCompanyTimeline(
    companyId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.companyTimeline.create({
      data: {
        companyId,
        event,
        description,
        details: details as Prisma.InputJsonValue,
        userId: userId || null,
      },
    });
  }

  private async logCompany(
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
      resource: 'company',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  // ─── Companies ───────────────────────────

  async createCompany(orgId: string, dto: CreateCompanyDto, userId: string, requestId: string) {
    const company = await this.prisma.company.create({
      data: {
        organizationId: orgId,
        ownerId: userId,
        name: dto.name,
        legalName: dto.legalName || null,
        gstNumber: dto.gstNumber || null,
        taxNumber: dto.taxNumber || null,
        registrationNumber: dto.registrationNumber || null,
        industry: dto.industry || null,
        companySize: dto.companySize ?? null,
        annualRevenue: dto.annualRevenue ?? null,
        website: dto.website || null,
        email: dto.email || null,
        phone: dto.phone || null,
        logo: dto.logo || null,
        description: dto.description || null,
        billingAddress: dto.billingAddress || null,
        shippingAddress: dto.shippingAddress || null,
        city: dto.city || null,
        state: dto.state || null,
        country: dto.country || null,
        postalCode: dto.postalCode || null,
        timezone: dto.timezone || 'UTC',
        currency: dto.currency || 'USD',
        isCustomer: dto.isCustomer ?? false,
        isVendor: dto.isVendor ?? false,
      },
    });

    await this.recordCompanyTimeline(
      company.id,
      'company.created',
      `Company created: ${company.name}`,
      { companyId: company.id },
      userId,
    );
    await this.logCompany(
      orgId,
      userId,
      'company.created',
      'CREATE',
      company.id,
      { name: company.name },
      requestId,
    );
    return company;
  }

  async findAllCompanies(orgId: string, query: CompanyQueryDto) {
    const {
      search,
      industry,
      ownerId,
      isCustomer,
      isVendor,
      isArchived,
      country,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legalName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (industry) where.industry = industry;
    if (ownerId) where.ownerId = ownerId;
    if (isCustomer !== undefined) where.isCustomer = isCustomer;
    if (isVendor !== undefined) where.isVendor = isVendor;
    if (isArchived !== undefined) where.isArchived = isArchived;
    if (country) where.country = country;

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: {
            select: { leads: true, notes: true, activities: { where: { deletedAt: null } } },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOneCompany(orgId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        leads: {
          where: { deletedAt: null },
          include: { tags: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
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
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateCompany(
    orgId: string,
    id: string,
    dto: UpdateCompanyDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOneCompany(orgId, id);

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) data[key] = value;
    }

    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...data,
        ...(dto.companySize !== undefined && { companySize: dto.companySize }),
        ...(dto.annualRevenue !== undefined && { annualRevenue: dto.annualRevenue }),
      },
    });

    await this.recordCompanyTimeline(
      id,
      'company.updated',
      `Company updated: ${company.name}`,
      {},
      userId,
    );
    await this.logCompany(
      orgId,
      userId,
      'company.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return company;
  }

  async archiveCompany(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOneCompany(orgId, id);
    const company = await this.prisma.company.update({ where: { id }, data: { isArchived: true } });
    await this.recordCompanyTimeline(id, 'company.archived', 'Company archived', {}, userId);
    await this.logCompany(orgId, userId, 'company.archived', 'UPDATE', id, {}, requestId);
    return company;
  }

  async restoreCompany(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOneCompany(orgId, id);
    const company = await this.prisma.company.update({
      where: { id },
      data: { isArchived: false },
    });
    await this.recordCompanyTimeline(
      id,
      'company.restored',
      'Company restored from archive',
      {},
      userId,
    );
    await this.logCompany(orgId, userId, 'company.restored', 'UPDATE', id, {}, requestId);
    return company;
  }

  async deleteCompany(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOneCompany(orgId, id);
    await this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.logCompany(orgId, userId, 'company.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Company deleted' };
  }

  // ─── Company Notes ───────────────────────

  async createCompanyNote(
    orgId: string,
    companyId: string,
    content: string,
    userId: string,
    requestId: string,
  ) {
    await this.findOneCompany(orgId, companyId);
    const note = await this.prisma.companyNote.create({
      data: { companyId, content, userId },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    await this.recordCompanyTimeline(
      companyId,
      'note.added',
      'Note added',
      { noteId: note.id },
      userId,
    );
    await this.logCompany(
      orgId,
      userId,
      'company.note.created',
      'CREATE',
      companyId,
      { noteId: note.id },
      requestId,
    );
    return note;
  }

  async listCompanyNotes(orgId: string, companyId: string, page = 1, limit = 50) {
    await this.findOneCompany(orgId, companyId);
    const where = { companyId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.companyNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.companyNote.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Company Activities ─────────────────

  async createCompanyActivity(
    orgId: string,
    companyId: string,
    dto: CreateLeadActivityDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOneCompany(orgId, companyId);
    const activity = await this.prisma.companyActivity.create({
      data: {
        companyId,
        type: dto.type as never,
        subject: dto.subject,
        description: dto.description || null,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        isCompleted: dto.isCompleted ?? false,
        userId,
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
    await this.recordCompanyTimeline(
      companyId,
      'activity.created',
      `Activity created: ${dto.type} - ${dto.subject}`,
      { activityId: activity.id, type: dto.type },
      userId,
    );
    await this.logCompany(
      orgId,
      userId,
      'company.activity.created',
      'CREATE',
      companyId,
      { activityId: activity.id, type: dto.type },
      requestId,
    );
    return activity;
  }

  async listCompanyActivities(orgId: string, companyId: string, page = 1, limit = 50) {
    await this.findOneCompany(orgId, companyId);
    const where = { companyId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.companyActivity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.companyActivity.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Company Timeline ────────────────────

  async getCompanyTimeline(orgId: string, companyId: string, page = 1, limit = 50) {
    await this.findOneCompany(orgId, companyId);
    const where = { companyId };
    const [data, total] = await Promise.all([
      this.prisma.companyTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.companyTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
