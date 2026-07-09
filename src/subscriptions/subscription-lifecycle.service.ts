import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionState, VALID_TRANSITIONS } from './interfaces/lifecycle.interface';

@Injectable()
export class SubscriptionLifecycleService {
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async activateTrial(
    organizationId: string,
    planId: string,
    trialDays: number,
  ): Promise<{ id: string; status: string }> {
    const existing = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (existing) {
      throw new BadRequestException('Organization already has a subscription');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId, deletedAt: null, isActive: true },
    });
    if (!plan) {
      throw new NotFoundException('Plan not found or inactive');
    }

    const now = new Date();
    const periodStart = new Date(now);
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + trialDays);

    const subscription = await this.prisma.organizationSubscription.create({
      data: {
        organizationId,
        planId,
        status: 'TRIAL',
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: periodEnd,
      },
      select: { id: true, status: true },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: {
        plan: this.mapPlanSlugToEnum(plan.slug),
        trialEndsAt: periodEnd,
      },
    });

    this.logger.log(`Trial activated: org=${organizationId}, plan=${plan.slug}, days=${trialDays}`);
    return subscription;
  }

  async activate(organizationId: string): Promise<{ id: string; status: string }> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    this.assertValidTransition(subscription.status, SubscriptionState.ACTIVE);

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'ACTIVE',
        trialEndsAt: null,
      },
      select: { id: true, status: true },
    });

    this.logger.log(`Subscription activated: org=${organizationId}`);
    return updated;
  }

  async cancel(organizationId: string): Promise<{ id: string; status: string }> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    this.assertValidTransition(subscription.status, SubscriptionState.CANCELED);

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'CANCELED',
        canceledAt: new Date(),
      },
      select: { id: true, status: true },
    });

    this.logger.log(`Subscription canceled: org=${organizationId}`);
    return updated;
  }

  async renew(organizationId: string): Promise<{ id: string; status: string }> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    if (subscription.status === 'EXPIRED') {
      throw new BadRequestException('Cannot renew an expired subscription');
    }

    const now = new Date();
    const periodEnd = new Date(now);

    if (subscription.plan.billingInterval === 'MONTHLY') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: {
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
      },
      select: { id: true, status: true },
    });

    this.logger.log(`Subscription renewed: org=${organizationId}`);
    return updated;
  }

  async suspend(organizationId: string): Promise<{ id: string; status: string }> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    this.assertValidTransition(subscription.status, SubscriptionState.SUSPENDED);

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: 'SUSPENDED' },
      select: { id: true, status: true },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan: 'FREE' },
    });

    this.logger.log(`Subscription suspended: org=${organizationId}`);
    return updated;
  }

  async expire(organizationId: string): Promise<{ id: string; status: string }> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    if (subscription.status === 'EXPIRED') {
      return { id: subscription.id, status: subscription.status };
    }

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: 'EXPIRED' },
      select: { id: true, status: true },
    });

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { plan: 'FREE', trialEndsAt: null },
    });

    this.logger.log(`Subscription expired: org=${organizationId}`);
    return updated;
  }

  async enterGracePeriod(organizationId: string): Promise<{ id: string; status: string }> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    this.assertValidTransition(subscription.status, SubscriptionState.GRACE_PERIOD);

    const updated = await this.prisma.organizationSubscription.update({
      where: { organizationId },
      data: { status: 'GRACE_PERIOD' },
      select: { id: true, status: true },
    });

    this.logger.log(`Subscription entered grace period: org=${organizationId}`);
    return updated;
  }

  async processExpiredSubscriptions(): Promise<number> {
    const now = new Date();

    const gracePeriodSubs = await this.prisma.organizationSubscription.findMany({
      where: {
        status: 'GRACE_PERIOD',
        currentPeriodEnd: { lte: now },
      },
      select: { organizationId: true },
    });

    for (const sub of gracePeriodSubs) {
      try {
        await this.suspend(sub.organizationId);
      } catch (error) {
        this.logger.error(
          `Failed to suspend expired grace period sub for org ${sub.organizationId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const expiredSubs = await this.prisma.organizationSubscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: now },
      },
      select: { organizationId: true },
    });

    for (const sub of expiredSubs) {
      try {
        await this.enterGracePeriod(sub.organizationId);
      } catch (error) {
        this.logger.error(
          `Failed to move expired sub to grace period for org ${sub.organizationId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    const total = gracePeriodSubs.length + expiredSubs.length;
    this.logger.log(`Processed ${total} expired subscription(s)`);
    return total;
  }

  private assertValidTransition(currentStatus: string, target: SubscriptionState): void {
    const transition = VALID_TRANSITIONS[target];
    if (!transition.from.includes(currentStatus as SubscriptionState)) {
      throw new BadRequestException(
        `Cannot transition from "${currentStatus}" to "${target}". ` +
          `Valid source states: [${transition.from.join(', ')}]`,
      );
    }
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
}
