import { Injectable, Logger } from '@nestjs/common';
import { FeatureResolver } from './feature-resolver.service';
import { UsageResolver } from './usage-resolver.service';
import { EntitlementResult } from './interfaces/entitlement.interface';

@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(
    private readonly featureResolver: FeatureResolver,
    private readonly usageResolver: UsageResolver,
  ) {}

  async can(organizationId: string, featureSlug: string): Promise<EntitlementResult> {
    const hasFeature = await this.featureResolver.hasFeature(organizationId, featureSlug);

    if (!hasFeature) {
      return {
        allowed: false,
        reason: `Feature "${featureSlug}" is not available on your current plan. Please upgrade to access this feature.`,
        featureSlug,
      };
    }

    const usageCheck = await this.usageResolver.canUse(organizationId, featureSlug);

    if (!usageCheck.withinLimits) {
      return {
        allowed: false,
        reason: usageCheck.message ?? `Usage limit reached for "${featureSlug}".`,
        featureSlug,
        metadata: {
          current: usageCheck.current,
          limit: usageCheck.limit,
          remaining: usageCheck.remaining,
        } as Record<string, unknown>,
      };
    }

    return {
      allowed: true,
      reason: null,
      featureSlug,
      metadata:
        usageCheck.limit !== null
          ? ({
              current: usageCheck.current,
              limit: usageCheck.limit,
              remaining: usageCheck.remaining,
            } as Record<string, unknown>)
          : undefined,
    };
  }

  async checkUsage(organizationId: string, featureSlug: string): Promise<EntitlementResult> {
    const hasFeature = await this.featureResolver.hasFeature(organizationId, featureSlug);

    if (!hasFeature) {
      return {
        allowed: false,
        reason: `Feature "${featureSlug}" is not available on your current plan.`,
        featureSlug,
      };
    }

    const usageCheck = await this.usageResolver.canUse(organizationId, featureSlug);

    return {
      allowed: usageCheck.withinLimits,
      reason: usageCheck.withinLimits ? null : (usageCheck.message ?? `Usage limit reached.`),
      featureSlug,
      metadata: {
        current: usageCheck.current,
        limit: usageCheck.limit,
        remaining: usageCheck.remaining,
      } as Record<string, unknown>,
    };
  }

  getReason(result: EntitlementResult): string | null {
    return result.reason;
  }
}
