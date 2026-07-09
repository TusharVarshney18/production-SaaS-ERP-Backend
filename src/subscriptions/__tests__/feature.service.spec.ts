import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { FeatureService } from '../feature.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FeatureService', () => {
  let service: FeatureService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockSubscription = {
    id: 'sub-1',
    organizationId: 'org-1',
    planId: 'plan-1',
    status: 'ACTIVE' as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    trialEndsAt: null,
    canceledAt: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    plan: {
      id: 'plan-1',
      name: 'Growth Plan',
      slug: 'growth',
      description: null,
      billingInterval: 'MONTHLY' as const,
      price: 2900,
      currency: 'USD',
      trialPeriodDays: 14,
      isActive: true,
      sortOrder: 1,
      deletedAt: null,
      deletedByUserId: null,
      deletedReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      features: [
        {
          id: 'pf-1',
          planId: 'plan-1',
          featureId: 'feat-1',
          value: 'true',
          isAvailable: true,
          feature: {
            id: 'feat-1',
            name: 'AI Import',
            slug: 'ai_import_enabled',
            description: null,
            group: 'ai',
            isActive: true,
            deletedAt: null,
            deletedByUserId: null,
            deletedReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      ],
    },
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new FeatureService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrganizationFeatures', () => {
    it('should return features for the organization', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.getOrganizationFeatures('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        slug: 'ai_import_enabled',
        name: 'AI Import',
        group: 'ai',
        value: 'true',
        isAvailable: true,
      });
    });

    it('should throw NotFoundException if no subscription exists', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getOrganizationFeatures('org-1')).rejects.toThrow(NotFoundException);
    });

    it('should only return features where isAvailable is true', async () => {
      const subscriptionWithFiltered = {
        ...mockSubscription,
        plan: {
          ...mockSubscription.plan,
          features: [...mockSubscription.plan.features],
        },
      };
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(
        subscriptionWithFiltered,
      );

      const result = await service.getOrganizationFeatures('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].slug).toBe('ai_import_enabled');
    });
  });

  describe('checkFeature', () => {
    it('should return enabled=true for an available feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(
        mockSubscription.plan.features[0].feature,
      );
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.checkFeature('org-1', 'ai_import_enabled');

      expect(result).toEqual({
        slug: 'ai_import_enabled',
        enabled: true,
        value: 'true',
      });
    });

    it('should return enabled=false for a non-existent feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkFeature('org-1', 'nonexistent');

      expect(result).toEqual({ slug: 'nonexistent', enabled: false, value: null });
    });

    it('should return enabled=false when feature is inactive', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription.plan.features[0].feature,
        isActive: false,
      });

      const result = await service.checkFeature('org-1', 'ai_import_enabled');

      expect(result).toEqual({ slug: 'ai_import_enabled', enabled: false, value: null });
    });

    it('should return enabled=false when no subscription exists', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(
        mockSubscription.plan.features[0].feature,
      );
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkFeature('org-1', 'ai_import_enabled');

      expect(result.enabled).toBe(false);
    });
  });

  describe('getFeatureValue', () => {
    it('should return feature value when enabled', async () => {
      jest.spyOn(service, 'checkFeature').mockResolvedValue({
        slug: 'ai_import_enabled',
        enabled: true,
        value: 'true',
      });

      const result = await service.getFeatureValue('org-1', 'ai_import_enabled');

      expect(result).toBe('true');
    });

    it('should return null when disabled', async () => {
      jest.spyOn(service, 'checkFeature').mockResolvedValue({
        slug: 'ai_import_enabled',
        enabled: false,
        value: null,
      });

      const result = await service.getFeatureValue('org-1', 'ai_import_enabled');

      expect(result).toBeNull();
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true when feature is enabled', async () => {
      jest.spyOn(service, 'checkFeature').mockResolvedValue({
        slug: 'ai_import_enabled',
        enabled: true,
        value: 'true',
      });

      const result = await service.isFeatureEnabled('org-1', 'ai_import_enabled');

      expect(result).toBe(true);
    });

    it('should return false when feature is disabled', async () => {
      jest.spyOn(service, 'checkFeature').mockResolvedValue({
        slug: 'ai_import_enabled',
        enabled: false,
        value: null,
      });

      const result = await service.isFeatureEnabled('org-1', 'ai_import_enabled');

      expect(result).toBe(false);
    });
  });
});
