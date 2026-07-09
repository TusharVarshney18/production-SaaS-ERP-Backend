import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PlanResolver } from '../plan-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PlanResolver', () => {
  let service: PlanResolver;
  let prisma: DeepMockProxy<PrismaService>;

  const mockSubscription = {
    id: 'sub-1',
    organizationId: 'org-1',
    planId: 'plan-1',
    status: 'ACTIVE' as const,
    currentPeriodStart: new Date('2026-07-01'),
    currentPeriodEnd: new Date('2026-08-01'),
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
    },
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new PlanResolver(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('resolveActivePlan', () => {
    it('should return resolved plan details', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.resolveActivePlan('org-1');

      expect(result.planId).toBe('plan-1');
      expect(result.planName).toBe('Growth Plan');
      expect(result.planSlug).toBe('growth');
      expect(result.isActive).toBe(true);
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resolveActivePlan('org-1')).rejects.toThrow(NotFoundException);
    });

    it('should mark expired subscriptions as not active', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'EXPIRED',
      });

      const result = await service.resolveActivePlan('org-1');

      expect(result.isActive).toBe(false);
    });
  });

  describe('resolveBillingCycle', () => {
    it('should return billing cycle details', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.resolveBillingCycle('org-1');

      expect(result.currentPeriodStart).toBeInstanceOf(Date);
      expect(result.currentPeriodEnd).toBeInstanceOf(Date);
      expect(typeof result.daysRemaining).toBe('number');
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resolveBillingCycle('org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resolveRenewalDate', () => {
    it('should return renewal date details', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.resolveRenewalDate('org-1');

      expect(result.nextRenewalDate).toBeInstanceOf(Date);
      expect(result.interval).toBe('MONTHLY');
      expect(typeof result.daysUntilRenewal).toBe('number');
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resolveRenewalDate('org-1')).rejects.toThrow(NotFoundException);
    });
  });
});
