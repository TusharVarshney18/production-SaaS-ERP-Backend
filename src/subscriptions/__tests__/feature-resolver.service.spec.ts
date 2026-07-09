import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { FeatureResolver } from '../feature-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('FeatureResolver', () => {
  let service: FeatureResolver;
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
    service = new FeatureResolver(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getEnabledFeatures', () => {
    it('should return enabled features for the organization', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.getEnabledFeatures('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        slug: 'ai_import_enabled',
        name: 'AI Import',
        group: 'ai',
        value: 'true',
        isAvailable: true,
      });
    });
  });

  describe('hasFeature', () => {
    it('should return true for an available feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(
        mockSubscription.plan.features[0].feature,
      );
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.hasFeature('org-1', 'ai_import_enabled');

      expect(result).toBe(true);
    });

    it('should return false for unavailable feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.hasFeature('org-1', 'nonexistent');

      expect(result).toBe(false);
    });
  });
});
