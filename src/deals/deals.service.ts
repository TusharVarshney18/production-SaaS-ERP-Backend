import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { MoveStageDto } from './dto/move-stage.dto';
import { ChangeOwnerDto } from './dto/change-owner.dto';
import { MarkWonDto } from './dto/mark-won.dto';
import { MarkLostDto } from './dto/mark-lost.dto';

@Injectable()
export class DealsService {
  private readonly logger = new Logger(DealsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async recordTimeline(
    dealId: string,
    event: string,
    description: string,
    details: Record<string, unknown>,
    userId?: string,
  ) {
    await this.prisma.dealTimeline.create({
      data: {
        dealId,
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
      resource: 'deal',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  // ─── Pipelines ────────────────────────────

  async createPipeline(orgId: string, dto: CreatePipelineDto, userId: string, requestId: string) {
    const pipeline = await this.prisma.pipeline.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        isDefault: dto.isDefault ?? false,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.log(
      orgId,
      userId,
      'pipeline.created',
      'CREATE',
      pipeline.id,
      { name: pipeline.name },
      requestId,
    );
    return pipeline;
  }

  async updatePipeline(
    orgId: string,
    id: string,
    dto: UpdatePipelineDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOnePipeline(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;

    const pipeline = await this.prisma.pipeline.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'pipeline.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return pipeline;
  }

  async listPipelines(orgId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId: orgId, isArchived: false },
      orderBy: { displayOrder: 'asc' },
      include: {
        stages: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { deals: true } },
      },
    });
  }

  async findOnePipeline(orgId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, organizationId: orgId },
      include: {
        stages: { orderBy: { displayOrder: 'asc' } },
        _count: { select: { deals: true } },
      },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async archivePipeline(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOnePipeline(orgId, id);
    const pipeline = await this.prisma.pipeline.update({
      where: { id },
      data: { isArchived: true },
    });
    await this.log(orgId, userId, 'pipeline.archived', 'UPDATE', id, {}, requestId);
    return pipeline;
  }

  async restorePipeline(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOnePipeline(orgId, id);
    const pipeline = await this.prisma.pipeline.update({
      where: { id },
      data: { isArchived: false },
    });
    await this.log(orgId, userId, 'pipeline.restored', 'UPDATE', id, {}, requestId);
    return pipeline;
  }

  async deletePipeline(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOnePipeline(orgId, id);
    await this.prisma.pipeline.delete({ where: { id } });
    await this.log(orgId, userId, 'pipeline.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Pipeline deleted' };
  }

  // ─── Stages ───────────────────────────────

  async createStage(
    orgId: string,
    pipelineId: string,
    dto: CreateStageDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOnePipeline(orgId, pipelineId);

    const maxOrder = await this.prisma.pipelineStage.aggregate({
      where: { pipelineId },
      _max: { displayOrder: true },
    });

    const stage = await this.prisma.pipelineStage.create({
      data: {
        pipelineId,
        name: dto.name,
        probability: dto.probability ?? 0,
        displayOrder: dto.displayOrder ?? (maxOrder._max.displayOrder ?? -1) + 1,
        color: dto.color ?? '#6366f1',
        isWon: dto.isWon ?? false,
        isLost: dto.isLost ?? false,
      },
    });

    await this.log(
      orgId,
      userId,
      'pipeline_stage.created',
      'CREATE',
      stage.id,
      { name: stage.name, pipelineId },
      requestId,
    );
    return stage;
  }

  async updateStage(
    orgId: string,
    pipelineId: string,
    stageId: string,
    dto: UpdateStageDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOnePipeline(orgId, pipelineId);
    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } });
    if (!stage) throw new NotFoundException('Stage not found');

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.isWon !== undefined) data.isWon = dto.isWon;
    if (dto.isLost !== undefined) data.isLost = dto.isLost;

    const updated = await this.prisma.pipelineStage.update({ where: { id: stageId }, data });
    await this.log(
      orgId,
      userId,
      'pipeline_stage.updated',
      'UPDATE',
      stageId,
      { changes: Object.keys(data) },
      requestId,
    );
    return updated;
  }

  async reorderStages(
    orgId: string,
    pipelineId: string,
    dto: ReorderStagesDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOnePipeline(orgId, pipelineId);

    await Promise.all(
      dto.stages.map((s) =>
        this.prisma.pipelineStage.update({
          where: { id: s.id },
          data: { displayOrder: s.displayOrder },
        }),
      ),
    );

    await this.log(
      orgId,
      userId,
      'pipeline_stage.reordered',
      'UPDATE',
      pipelineId,
      { stageCount: dto.stages.length },
      requestId,
    );
    return { message: 'Stages reordered' };
  }

  async deleteStage(
    orgId: string,
    pipelineId: string,
    stageId: string,
    userId: string,
    requestId: string,
  ) {
    await this.findOnePipeline(orgId, pipelineId);
    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: stageId, pipelineId } });
    if (!stage) throw new NotFoundException('Stage not found');

    await this.prisma.pipelineStage.delete({ where: { id: stageId } });
    await this.log(
      orgId,
      userId,
      'pipeline_stage.deleted',
      'DELETE',
      stageId,
      { pipelineId },
      requestId,
    );
    return { message: 'Stage deleted' };
  }

  // ─── Deals ────────────────────────────────

  async create(orgId: string, dto: CreateDealDto, userId: string, requestId: string) {
    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: dto.stageId } });
    if (!stage) throw new NotFoundException('Stage not found');

    const deal = await this.prisma.deal.create({
      data: {
        organizationId: orgId,
        pipelineId: dto.pipelineId,
        stageId: dto.stageId,
        ownerId: userId,
        title: dto.title,
        description: dto.description || null,
        value: dto.value ?? 0,
        currency: dto.currency || 'USD',
        probability: dto.probability ?? stage.probability,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null,
        status: (dto.status as never) || 'OPEN',
        companyId: dto.companyId || null,
        primaryContactId: dto.primaryContactId || null,
        leadId: dto.leadId || null,
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      deal.id,
      'deal.created',
      `Deal created: ${deal.title}`,
      { dealId: deal.id },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'deal.created',
      'CREATE',
      deal.id,
      { title: deal.title },
      requestId,
    );
    return deal;
  }

  async findAll(orgId: string, query: DealQueryDto) {
    const {
      search,
      pipelineId,
      stageId,
      ownerId,
      status,
      minValue,
      maxValue,
      expectedCloseAfter,
      expectedCloseBefore,
      createdAfter,
      createdBefore,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [{ title: { contains: search, mode: 'insensitive' } }];
    }
    if (pipelineId) where.pipelineId = pipelineId;
    if (stageId) where.stageId = stageId;
    if (ownerId) where.ownerId = ownerId;
    if (status) where.status = status;

    if (minValue !== undefined || maxValue !== undefined) {
      const value: Record<string, number> = {};
      if (minValue !== undefined) value.gte = minValue;
      if (maxValue !== undefined) value.lte = maxValue;
      where.value = value;
    }

    if (expectedCloseAfter || expectedCloseBefore) {
      const expectedCloseDate: Record<string, Date | string> = {};
      if (expectedCloseAfter) expectedCloseDate.gte = new Date(expectedCloseAfter);
      if (expectedCloseBefore) expectedCloseDate.lte = new Date(expectedCloseBefore);
      where.expectedCloseDate = expectedCloseDate;
    }

    if (createdAfter || createdBefore) {
      const createdAt: Record<string, Date | string> = {};
      if (createdAfter) createdAt.gte = new Date(createdAfter);
      if (createdBefore) createdAt.lte = new Date(createdBefore);
      where.createdAt = createdAt;
    }

    const [data, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, color: true } },
          company: { select: { id: true, name: true } },
          primaryContact: { select: { id: true, fullName: true, email: true } },
          owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.deal.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const deal = await this.prisma.deal.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, color: true } },
        company: { select: { id: true, name: true } },
        primaryContact: { select: { id: true, fullName: true, email: true } },
        lead: { select: { id: true, contactName: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
        timeline: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!deal) throw new NotFoundException('Deal not found');
    return deal;
  }

  async update(orgId: string, id: string, dto: UpdateDealDto, userId: string, requestId: string) {
    const existing = await this.findOne(orgId, id);
    const prevValue = existing.value;

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.value !== undefined) data.value = dto.value;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.expectedCloseDate !== undefined)
      data.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : null;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;
    if (dto.lossReason !== undefined) data.lossReason = dto.lossReason;
    if (dto.wonReason !== undefined) data.wonReason = dto.wonReason;

    const deal = await this.prisma.deal.update({
      where: { id },
      data,
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, color: true } },
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (dto.value !== undefined && dto.value !== prevValue) {
      await this.recordTimeline(
        id,
        'deal.value_changed',
        `Value changed from ${prevValue} to ${dto.value}`,
        { from: prevValue, to: dto.value },
        userId,
      );
    }
    await this.recordTimeline(
      id,
      'deal.updated',
      `Deal updated: ${deal.title}`,
      { changes: Object.keys(data) },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'deal.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return deal;
  }

  async moveStage(orgId: string, id: string, dto: MoveStageDto, userId: string, requestId: string) {
    const existing = await this.findOne(orgId, id);
    const prevStage = existing.stage;

    const stage = await this.prisma.pipelineStage.findFirst({ where: { id: dto.stageId } });
    if (!stage) throw new NotFoundException('Stage not found');

    const deal = await this.prisma.deal.update({
      where: { id },
      data: { stageId: dto.stageId, probability: stage.probability },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    const prevName = prevStage ? prevStage.name : 'unknown';
    await this.recordTimeline(
      id,
      'deal.stage_changed',
      `Stage changed from ${prevName} to ${stage.name}`,
      { from: prevStage?.id, to: dto.stageId, reason: dto.reason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'deal.stage_changed',
      'UPDATE',
      id,
      { from: prevStage?.id, to: dto.stageId },
      requestId,
    );
    return deal;
  }

  async changeOwner(
    orgId: string,
    id: string,
    dto: ChangeOwnerDto,
    userId: string,
    requestId: string,
  ) {
    const existing = await this.findOne(orgId, id);
    const prevOwnerId = existing.ownerId;

    const deal = await this.prisma.deal.update({
      where: { id },
      data: { ownerId: dto.ownerId },
      include: {
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'deal.owner_changed',
      `Owner changed`,
      { from: prevOwnerId, to: dto.ownerId },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'deal.owner_changed',
      'UPDATE',
      id,
      { from: prevOwnerId, to: dto.ownerId },
      requestId,
    );
    return deal;
  }

  async markWon(orgId: string, id: string, dto: MarkWonDto, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: {
        status: 'WON',
        wonReason: dto.wonReason || null,
        actualCloseDate: dto.actualCloseDate ? new Date(dto.actualCloseDate) : new Date(),
      },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'deal.won',
      `Deal won: ${deal.title}`,
      { wonReason: dto.wonReason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'deal.won',
      'UPDATE',
      id,
      { wonReason: dto.wonReason },
      requestId,
    );
    return deal;
  }

  async markLost(orgId: string, id: string, dto: MarkLostDto, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: {
        status: 'LOST',
        lossReason: dto.lossReason || null,
        actualCloseDate: dto.actualCloseDate ? new Date(dto.actualCloseDate) : new Date(),
      },
      include: {
        stage: { select: { id: true, name: true, color: true } },
        owner: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    await this.recordTimeline(
      id,
      'deal.lost',
      `Deal lost: ${deal.title}`,
      { lossReason: dto.lossReason },
      userId,
    );
    await this.log(
      orgId,
      userId,
      'deal.lost',
      'UPDATE',
      id,
      { lossReason: dto.lossReason },
      requestId,
    );
    return deal;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { isArchived: true, status: 'ARCHIVED' as never },
    });
    await this.recordTimeline(id, 'deal.archived', 'Deal archived', {}, userId);
    await this.log(orgId, userId, 'deal.archived', 'UPDATE', id, {}, requestId);
    return deal;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const deal = await this.prisma.deal.update({
      where: { id },
      data: { isArchived: false, status: 'OPEN' as never },
    });
    await this.recordTimeline(id, 'deal.restored', 'Deal restored from archive', {}, userId);
    await this.log(orgId, userId, 'deal.restored', 'UPDATE', id, {}, requestId);
    return deal;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'deal.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Deal deleted' };
  }

  async getTimeline(orgId: string, dealId: string, page = 1, limit = 50) {
    await this.findOne(orgId, dealId);
    const where = { dealId };
    const [data, total] = await Promise.all([
      this.prisma.dealTimeline.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.dealTimeline.count({ where }),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // ─── Dashboard Stats ──────────────────────

  async getDashboardStats(orgId: string) {
    const [openCount, wonCount, lostCount, pipelineValue, avgValue] = await Promise.all([
      this.prisma.deal.count({
        where: {
          organizationId: orgId,
          deletedAt: null,
          status: 'OPEN' as never,
          isArchived: false,
        },
      }),
      this.prisma.deal.count({
        where: { organizationId: orgId, deletedAt: null, status: 'WON' as never },
      }),
      this.prisma.deal.count({
        where: { organizationId: orgId, deletedAt: null, status: 'LOST' as never },
      }),
      this.prisma.deal.aggregate({
        where: { organizationId: orgId, deletedAt: null, status: { not: 'LOST' as never } },
        _sum: { value: true },
      }),
      this.prisma.deal.aggregate({
        where: { organizationId: orgId, deletedAt: null, status: 'WON' as never },
        _avg: { value: true },
      }),
    ]);

    const closedDeals = wonCount + lostCount || 1;
    const winRatePct = Math.round((wonCount / closedDeals) * 100);

    return {
      openDeals: openCount,
      wonDeals: wonCount,
      lostDeals: lostCount,
      pipelineValue: pipelineValue._sum.value || 0,
      winRate: winRatePct,
      averageDealValue: avgValue._avg.value ? Math.round(avgValue._avg.value) : 0,
    };
  }
}
