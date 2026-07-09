import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureResolver } from './feature-resolver.service';
import { UsageResult, UsageCheckResult } from './interfaces/usage-result.interface';

@Injectable()
export class UsageResolver {
  private readonly logger = new Logger(UsageResolver.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureResolver: FeatureResolver,
  ) {}

  async canUseFeature(
    organizationId: string,
    featureSlug: string,
    _amount = 1,
    period?: string,
  ): Promise<UsageCheckResult> {
    return this.checkUsage(organizationId, featureSlug, period);
  }

  async incrementUsage(
    organizationId: string,
    featureSlug: string,
    amount = 1,
    period?: string,
  ): Promise<UsageResult> {
    return this.increment(organizationId, featureSlug, amount, period);
  }

  async resetUsage(organizationId: string, featureSlug: string, period?: string): Promise<void> {
    const currentPeriod = period || this.getCurrentPeriod();
    const feature = await this.prisma.feature.findUnique({
      where: { slug: featureSlug },
    });
    if (!feature) {
      throw new NotFoundException(`Feature "${featureSlug}" not found`);
    }

    await this.prisma.usageCounter.deleteMany({
      where: {
        organizationId,
        featureId: feature.id,
        period: currentPeriod,
      },
    });

    this.logger.log(
      `Usage reset: org=${organizationId}, feature=${featureSlug}, period=${currentPeriod}`,
    );
  }

  async getUsage(organizationId: string): Promise<UsageResult[]> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    const counters = await this.prisma.usageCounter.findMany({
      where: { organizationId },
      include: { feature: true },
    });

    return counters.map((counter) => {
      const remaining = counter.hardLimit !== null ? counter.hardLimit - counter.usage : null;
      const withinLimits = counter.hardLimit !== null ? counter.usage <= counter.hardLimit : true;
      const isSoftLimitReached =
        counter.softLimit !== null ? counter.usage >= counter.softLimit : false;

      return {
        featureSlug: counter.feature.slug,
        featureName: counter.feature.name,
        period: counter.period,
        usage: counter.usage,
        softLimit: counter.softLimit,
        hardLimit: counter.hardLimit,
        remaining,
        withinLimits,
        isSoftLimitReached,
      };
    });
  }

  async checkUsage(
    organizationId: string,
    featureSlug: string,
    period?: string,
  ): Promise<UsageCheckResult> {
    const currentPeriod = period || this.getCurrentPeriod();

    const limitValue = await this.featureResolver.getFeatureValue(organizationId, featureSlug);

    const limit = limitValue !== null ? parseInt(limitValue, 10) : null;

    if (limit !== null && isNaN(limit)) {
      this.logger.warn(`Non-numeric limit value for feature "${featureSlug}": ${limitValue}`);
      return {
        withinLimits: true,
        current: 0,
        limit: null,
        remaining: null,
        message: null,
      };
    }

    const feature = await this.prisma.feature.findUnique({
      where: { slug: featureSlug },
    });

    if (!feature) {
      return {
        withinLimits: true,
        current: 0,
        limit: null,
        remaining: null,
        message: null,
      };
    }

    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        organizationId_featureId_period: {
          organizationId,
          featureId: feature.id,
          period: currentPeriod,
        },
      },
    });

    const current = counter?.usage ?? 0;

    if (limit === null) {
      return {
        withinLimits: true,
        current,
        limit: null,
        remaining: null,
        message: null,
      };
    }

    const remaining = Math.max(0, limit - current);
    const withinLimits = current < limit;

    return {
      withinLimits,
      current,
      limit,
      remaining,
      message: withinLimits
        ? null
        : `Usage limit reached for "${featureSlug}": ${current}/${limit}`,
    };
  }

  async increment(
    organizationId: string,
    featureSlug: string,
    amount = 1,
    period?: string,
  ): Promise<UsageResult> {
    const currentPeriod = period || this.getCurrentPeriod();

    const feature = await this.prisma.feature.findUnique({
      where: { slug: featureSlug },
    });

    if (!feature) {
      throw new NotFoundException(`Feature "${featureSlug}" not found`);
    }

    const counter = await this.prisma.usageCounter.upsert({
      where: {
        organizationId_featureId_period: {
          organizationId,
          featureId: feature.id,
          period: currentPeriod,
        },
      },
      create: {
        organizationId,
        featureId: feature.id,
        period: currentPeriod,
        usage: amount,
      },
      update: {
        usage: { increment: amount },
      },
    });

    const limitValue = await this.featureResolver.getFeatureValue(organizationId, featureSlug);
    const hardLimit = limitValue !== null ? parseInt(limitValue, 10) : null;

    const remaining =
      hardLimit !== null && !isNaN(hardLimit) ? Math.max(0, hardLimit - counter.usage) : null;
    const withinLimits =
      hardLimit !== null && !isNaN(hardLimit) ? counter.usage <= hardLimit : true;
    const isSoftLimitReached =
      counter.softLimit !== null ? counter.usage >= counter.softLimit : false;

    return {
      featureSlug,
      featureName: feature.name,
      period: counter.period,
      usage: counter.usage,
      softLimit: counter.softLimit,
      hardLimit,
      remaining,
      withinLimits,
      isSoftLimitReached,
    };
  }

  async getRemainingQuota(
    organizationId: string,
    featureSlug: string,
    period?: string,
  ): Promise<number | null> {
    const result = await this.checkUsage(organizationId, featureSlug, period);
    return result.remaining;
  }

  private getCurrentPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
