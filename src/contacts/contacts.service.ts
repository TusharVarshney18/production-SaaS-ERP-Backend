import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactQueryDto } from './dto/contact-query.dto';
import { MoveContactDto } from './dto/move-contact.dto';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async recordTimeline(
    contactId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.contactTimeline.create({
      data: {
        contactId,
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
      resource: 'contact',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateContactDto, userId: string, requestId: string) {
    const fullName = `${dto.firstName} ${dto.lastName}`.trim();

    const contact = await this.prisma.contact.create({
      data: {
        organizationId: orgId,
        ownerId: userId,
        companyId: dto.companyId || null,
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName,
        designation: dto.designation || null,
        department: dto.department || null,
        email: dto.email || null,
        phone: dto.phone || null,
        mobile: dto.mobile || null,
        whatsapp: dto.whatsapp || null,
        linkedin: dto.linkedin || null,
        website: dto.website || null,
        birthday: dto.birthday ? new Date(dto.birthday) : null,
        preferredLanguage: dto.preferredLanguage || null,
        timezone: dto.timezone || 'UTC',
        status: (dto.status as never) || 'ACTIVE',
        isPrimary: dto.isPrimary ?? false,
        isDecisionMaker: dto.isDecisionMaker ?? false,
        notes: dto.notes || null,
        avatar: dto.avatar || null,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    await this.recordTimeline(
      contact.id,
      'contact.created',
      `Contact created: ${fullName}`,
      { contactId: contact.id },
      userId,
    );
    await this.log(orgId, userId, 'contact.created', 'CREATE', contact.id, { fullName }, requestId);

    return contact;
  }

  async findAll(orgId: string, query: ContactQueryDto) {
    const {
      search,
      companyId,
      ownerId,
      isPrimary,
      isDecisionMaker,
      isArchived,
      status,
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
        { fullName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { designation: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (companyId) where.companyId = companyId;
    if (ownerId) where.ownerId = ownerId;
    if (isPrimary !== undefined) where.isPrimary = isPrimary;
    if (isDecisionMaker !== undefined) where.isDecisionMaker = isDecisionMaker;
    if (isArchived !== undefined) where.isArchived = isArchived;
    if (status) where.status = status;
    if (createdAfter || createdBefore) {
      const createdAt: Record<string, Date | string> = {};
      if (createdAfter) createdAt.gte = new Date(createdAfter);
      if (createdBefore) createdAt.lte = new Date(createdBefore);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
          _count: { select: { timeline: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateContactDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findOne(orgId, id);

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.designation !== undefined) data.designation = dto.designation;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.mobile !== undefined) data.mobile = dto.mobile;
    if (dto.whatsapp !== undefined) data.whatsapp = dto.whatsapp;
    if (dto.linkedin !== undefined) data.linkedin = dto.linkedin;
    if (dto.website !== undefined) data.website = dto.website;
    if (dto.birthday !== undefined) data.birthday = dto.birthday ? new Date(dto.birthday) : null;
    if (dto.preferredLanguage !== undefined) data.preferredLanguage = dto.preferredLanguage;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
    if (dto.isDecisionMaker !== undefined) data.isDecisionMaker = dto.isDecisionMaker;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

    const firstName = (dto.firstName ?? existing.firstName) as string;
    const lastName = (dto.lastName ?? existing.lastName) as string;
    data.fullName = `${firstName} ${lastName}`.trim();

    const contact = await this.prisma.contact.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    await this.recordTimeline(
      id,
      'contact.updated',
      `Contact updated: ${data.fullName}`,
      { changes: Object.keys(dto) },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'contact.updated',
      'UPDATE',
      id,
      { changes: Object.keys(dto) },
      requestId,
    );

    return contact;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const contact = await this.prisma.contact.update({
      where: { id },
      data: { isArchived: true },
    });
    await this.recordTimeline(id, 'contact.archived', 'Contact archived', {}, userId);
    await this.log(orgId, userId, 'contact.archived', 'UPDATE', id, {}, requestId);
    return contact;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const contact = await this.prisma.contact.update({
      where: { id },
      data: { isArchived: false },
    });
    await this.recordTimeline(id, 'contact.restored', 'Contact restored from archive', {}, userId);
    await this.log(orgId, userId, 'contact.restored', 'UPDATE', id, {}, requestId);
    return contact;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'contact.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Contact deleted' };
  }

  async setPrimary(orgId: string, id: string, userId: string, requestId: string) {
    const contact = await this.findOne(orgId, id);

    await this.prisma.contact.updateMany({
      where: { organizationId: orgId, ownerId: contact.ownerId, isPrimary: true, id: { not: id } },
      data: { isPrimary: false },
    });

    const updated = await this.prisma.contact.update({
      where: { id },
      data: { isPrimary: true },
    });

    await this.recordTimeline(id, 'contact.primary_changed', 'Contact set as primary', {}, userId);
    await this.log(orgId, userId, 'contact.primary_changed', 'UPDATE', id, {}, requestId);
    return updated;
  }

  async setDecisionMaker(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const contact = await this.prisma.contact.update({
      where: { id },
      data: { isDecisionMaker: true },
    });

    await this.recordTimeline(
      id,
      'contact.decision_maker_changed',
      'Contact set as decision maker',
      {},
      userId,
    );
    await this.log(orgId, userId, 'contact.decision_maker_changed', 'UPDATE', id, {}, requestId);
    return contact;
  }

  async moveCompany(
    orgId: string,
    id: string,
    dto: MoveContactDto,
    userId: string,
    requestId: string,
  ) {
    const contact = await this.findOne(orgId, id);
    const prevCompanyId = contact.companyId;

    const updated = await this.prisma.contact.update({
      where: { id },
      data: { companyId: dto.companyId },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    await this.recordTimeline(
      id,
      'contact.company_changed',
      `Company changed from ${prevCompanyId || 'none'} to ${dto.companyId}`,
      { from: prevCompanyId, to: dto.companyId, reason: dto.reason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'contact.company_changed',
      'UPDATE',
      id,
      { from: prevCompanyId, to: dto.companyId },
      requestId,
    );
    return updated;
  }

  async getTimeline(orgId: string, contactId: string, page = 1, limit = 50) {
    await this.findOne(orgId, contactId);
    const where = { contactId };
    const [data, total] = await Promise.all([
      this.prisma.contactTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.contactTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
