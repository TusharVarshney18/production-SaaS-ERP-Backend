import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanQueryDto } from './dto/plan-query.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ──────────────────────────────────────────────
  // SubscriptionPlan CRUD
  // ──────────────────────────────────────────────

  async createPlan(dto: CreatePlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Plan slug already exists');
    }

    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        billingInterval: dto.billingInterval,
        price: dto.price,
        currency: dto.currency ?? 'USD',
        trialPeriodDays: dto.trialPeriodDays ?? 0,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    this.logger.log(`Subscription plan created: ${plan.id} (${plan.slug})`);
    return plan;
  }

  async findAllPlans(query: PlanQueryDto) {
    const {
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = query;

    const where: Prisma.SubscriptionPlanWhereInput = { deletedAt: null };

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const orderBy: Prisma.SubscriptionPlanOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.subscriptionPlan.count({ where }),
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

  async findPlanById(id: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id, deletedAt: null },
      include: {
        features: {
          include: { feature: true },
        },
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  async findPlanBySlug(slug: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { slug, deletedAt: null },
      include: {
        features: {
          include: { feature: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    return plan;
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id, deletedAt: null },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        billingInterval: dto.billingInterval,
        price: dto.price,
        currency: dto.currency,
        trialPeriodDays: dto.trialPeriodDays,
        isActive: dto.isActive,
        sortOrder: dto.sortOrder,
      },
    });

    this.logger.log(`Subscription plan updated: ${id}`);
    return updated;
  }

  async softDeletePlan(id: string, userId: string, reason?: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id, deletedAt: null },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found');
    }

    const activeSubscriptions = await this.prisma.organizationSubscription.count({
      where: { planId: id, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    });

    if (activeSubscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan with ${activeSubscriptions} active subscription(s). Deactivate the plan instead.`,
      );
    }

    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedByUserId: userId,
        deletedReason: reason ?? null,
      },
    });

    this.logger.log(`Subscription plan soft-deleted: ${id}`);
  }

  // ──────────────────────────────────────────────
  // OrganizationSubscription Lifecycle
  // ──────────────────────────────────────────────

  async activateTrial(organizationId: string, dto: CreateSubscriptionDto) {
    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (existing) {
      throw new ConflictException('Organization already has a subscription');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId, deletedAt: null, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException('Subscription plan not found or inactive');
    }

    const trialDays = dto.trialPeriodDays ?? plan.trialPeriodDays;
    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + (trialDays > 0 ? trialDays : 30));

    const subscription = await this.prisma.organizationSubscription.create({
      data: {
        organizationId,
        planId: plan.id,
        status: trialDays > 0 ? 'ACTIVE' : 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: trialDays > 0 ? new Date(now.getTime() + trialDays * 86400000) : null,
      },
      include: { plan: true },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: this.mapPlanSlugToEnum(plan.slug),
        trialEndsAt: subscription.trialEndsAt,
      },
    });

    this.logger.log(
      `Trial activated for organization ${organizationId} on plan ${plan.slug} (${trialDays} days)`,
    );
    return subscription;
  }

  async getSubscription(organizationId: string) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: {
          include: {
            features: {
              include: { feature: true },
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    return subscription;
  }

  async changePlan(organizationId: string, dto: ChangePlanDto) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    const targetPlan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.planId, deletedAt: null, isActive: true },
    });
    if (!targetPlan) {
      throw new NotFoundException('Target plan not found or inactive');
    }

    if (subscription.planId === targetPlan.id) {
      throw new BadRequestException('Organization is already on this plan');
    }

    const isUpgrade = targetPlan.sortOrder > subscription.plan.sortOrder;

    if (dto.immediate && !isUpgrade) {
      throw new BadRequestException(
        'Immediate plan changes are only allowed for upgrades. Downgrades take effect at period end.',
      );
    }

    if (dto.immediate) {
      const updated = await this.prisma.organizationSubscription.update({
        where: { organizationId },
        data: {
          planId: targetPlan.id,
          currentPeriodStart: new Date(),
          currentPeriodEnd: this.calculatePeriodEnd(targetPlan.billingInterval),
        },
        include: { plan: true },
      });

      await this.syncOrganizationPlan(organizationId, targetPlan.slug);

      this.logger.log(
        `Organization ${organizationId} upgraded immediately to plan ${targetPlan.slug}`,
      );
      return updated;
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        planId: targetPlan.id,
      },
      include: { plan: true },
    });

    await this.syncOrganizationPlan(organizationId, targetPlan.slug);

    this.logger.log(
      `Organization ${organizationId} plan changed to ${targetPlan.slug} (effective ${
        isUpgrade ? 'immediately' : 'at period end'
      })`,
    );
    return updated;
  }

  async cancelSubscription(organizationId: string) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    if (subscription.status === 'CANCELED') {
      throw new BadRequestException('Subscription is already canceled');
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
      include: { plan: true },
    });

    this.logger.log(`Organization ${organizationId} subscription canceled`);
    return updated;
  }

  async renewSubscription(organizationId: string) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    if (subscription.status === 'EXPIRED') {
      throw new BadRequestException('Cannot renew an expired subscription. Create a new one.');
    }

    const now = new Date();

    if (subscription.status === 'CANCELED') {
      const updated = await this.prisma.organizationSubscription.update({
        where: { organizationId },
        data: {
          status: 'ACTIVE',
          canceledAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: this.calculatePeriodEnd(subscription.plan.billingInterval),
        },
        include: { plan: true },
      });

      this.logger.log(`Organization ${organizationId} subscription renewed (reactivated)`);
      return updated;
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        currentPeriodStart: now,
        currentPeriodEnd: this.calculatePeriodEnd(subscription.plan.billingInterval),
      },
      include: { plan: true },
    });

    this.logger.log(`Organization ${organizationId} subscription renewed (period extended)`);
    return updated;
  }

  async expireSubscription(organizationId: string) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    if (subscription.status === 'EXPIRED') {
      return subscription;
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'EXPIRED',
      },
      include: { plan: true },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: 'FREE',
        trialEndsAt: null,
      },
    });

    this.logger.log(`Organization ${organizationId} subscription expired`);
    return updated;
  }

  async markPastDue(organizationId: string) {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    if (subscription.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot mark as past_due when status is ${subscription.status}`,
      );
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: 'PAST_DUE' },
      include: { plan: true },
    });

    this.logger.log(`Organization ${organizationId} subscription marked as past_due`);
    return updated;
  }

  async handleExpiredSubscriptions() {
    const now = new Date();

    const expiredSubscriptions = await this.prisma.organizationSubscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
      },
      select: { organizationId: true },
    });

    this.logger.log(`Found ${expiredSubscriptions.length} expired subscription(s) to process`);

    for (const sub of expiredSubscriptions) {
      try {
        await this.expireSubscription(sub.organizationId);
      } catch (error) {
        this.logger.error(
          `Failed to expire subscription for organization ${sub.organizationId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return { processed: expiredSubscriptions.length };
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  private async syncOrganizationPlan(organizationId: string, planSlug: string) {
    const orgPlan = this.mapPlanSlugToEnum(planSlug);
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan: orgPlan },
    });
  }

  private mapPlanSlugToEnum(slug: string) {
    switch (slug) {
      case 'free':
        return 'FREE' as const;
      case 'starter':
      case 'growth':
        return 'STARTER' as const;
      case 'pro':
      case 'business':
        return 'PRO' as const;
      case 'enterprise':
        return 'ENTERPRISE' as const;
      default:
        return 'FREE' as const;
    }
  }

  private calculatePeriodEnd(interval: string): Date {
    const date = new Date();
    switch (interval) {
      case 'MONTHLY':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'YEARLY':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
    }
    return date;
  }
}
