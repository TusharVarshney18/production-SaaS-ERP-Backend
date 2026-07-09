import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureResult, FeatureCheckResult } from './interfaces/feature-result.interface';

@Injectable()
export class FeatureResolver {
  private readonly logger = new Logger(FeatureResolver.name);

  constructor(private readonly prisma: PrismaService) {}

  async getEnabledFeatures(organizationId: string): Promise<FeatureResult[]> {
    return this.getOrganizationFeatures(organizationId);
  }

  async hasFeature(organizationId: string, featureSlug: string): Promise<boolean> {
    const result = await this.checkFeature(organizationId, featureSlug);
    return result.enabled;
  }

  async getOrganizationFeatures(organizationId: string): Promise<FeatureResult[]> {
    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: {
          include: {
            features: {
              include: {
                feature: true,
              },
              where: { isAvailable: true },
            },
          },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this organization');
    }

    return subscription.plan.features.map((pf) => ({
      slug: pf.feature.slug,
      name: pf.feature.name,
      group: pf.feature.group,
      value: pf.value,
      isAvailable: pf.isAvailable,
    }));
  }

  async checkFeature(organizationId: string, featureSlug: string): Promise<FeatureCheckResult> {
    const feature = await this.prisma.feature.findUnique({
      where: { slug: featureSlug },
    });

    if (!feature || !feature.isActive) {
      return { slug: featureSlug, enabled: false, value: null };
    }

    const subscription = await this.prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: {
        plan: {
          include: {
            features: {
              where: { feature: { slug: featureSlug } },
              include: { feature: true },
            },
          },
        },
      },
    });

    if (!subscription) {
      return { slug: featureSlug, enabled: false, value: null };
    }

    const planFeature = subscription.plan.features[0];
    if (!planFeature || !planFeature.isAvailable) {
      return { slug: featureSlug, enabled: false, value: null };
    }

    return {
      slug: featureSlug,
      enabled: true,
      value: planFeature.value,
    };
  }

  async getFeatureValue(organizationId: string, featureSlug: string): Promise<string | null> {
    const result = await this.checkFeature(organizationId, featureSlug);
    return result.enabled ? result.value : null;
  }
}
