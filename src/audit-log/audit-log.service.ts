import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActorType, AuditSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

export interface CreateAuditLogParams {
  organizationId: string;
  actorId?: string | null;
  actorType: ActorType;
  event: string;
  resource: string;
  resourceId?: string | null;
  action: string;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity?: AuditSeverity;
  requestId: string;
  correlationId?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(params: CreateAuditLogParams) {
    const log = await this.prisma.auditLog.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId || null,
        actorType: params.actorType,
        event: params.event,
        resource: params.resource,
        resourceId: params.resourceId || null,
        action: params.action,
        details:
          params.details !== null && params.details !== undefined
            ? (params.details as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        severity: params.severity || AuditSeverity.INFO,
        requestId: params.requestId,
        correlationId: params.correlationId || null,
      },
    });

    this.logger.debug(`Audit log created: ${log.id} (${params.event})`);
    return log;
  }

  async findAll(organizationId: string, query: AuditLogQueryDto) {
    const {
      event,
      resource,
      resourceId,
      actorId,
      actorType,
      severity,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.AuditLogWhereInput = { organizationId };

    if (event) where.event = event;
    if (resource) where.resource = resource;
    if (resourceId) where.resourceId = resourceId;
    if (actorId) where.actorId = actorId;
    if (actorType) where.actorType = actorType;
    if (severity) where.severity = severity;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(organizationId: string, id: string) {
    const log = await this.prisma.auditLog.findFirst({
      where: { id, organizationId },
    });

    if (!log) {
      throw new NotFoundException('Audit log entry not found');
    }

    return log;
  }
}
