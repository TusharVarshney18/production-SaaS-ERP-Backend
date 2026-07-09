import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResolvedPlan, BillingCycle, RenewalDate } from './interfaces/plan-resolver.interface';

@Injectable()
export class PlanResolver {
  private readonly logger = new Logger(PlanResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  async resolveActivePlan(organizationId: string): Promise<ResolvedPlan> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found for this organization');
    }

    return {
      planId: subscription.plan.id,
      planName: subscription.plan.name,
      planSlug: subscription.plan.slug,
      billingInterval: subscription.plan.billingInterval,
      price: subscription.plan.price,
      currency: subscription.plan.currency,
      isActive:
        subscription.status === 'ACTIVE' ||
        subscription.status === 'TRIAL' ||
        subscription.status === 'GRACE_PERIOD',
    };
  }

  async resolveBillingCycle(organizationId: string): Promise<BillingCycle> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    const diffMs = periodEnd.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: periodEnd,
      daysRemaining,
      isExpired: daysRemaining <= 0,
    };
  }

  async resolveRenewalDate(organizationId: string): Promise<RenewalDate> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    const now = new Date();
    const renewalDate = subscription.currentPeriodEnd;
    const diffMs = renewalDate.getTime() - now.getTime();
    const daysUntilRenewal = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      nextRenewalDate: renewalDate,
      daysUntilRenewal,
      interval: subscription.plan.billingInterval,
    };
  }
}
