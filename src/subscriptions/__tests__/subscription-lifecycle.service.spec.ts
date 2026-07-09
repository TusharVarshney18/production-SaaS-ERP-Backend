import { BadRequestException, NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SubscriptionLifecycleService } from '../subscription-lifecycle.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('SubscriptionLifecycleService', () => {
  let service: SubscriptionLifecycleService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockPlan = {
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
  };

  const mockSubscription = {
    id: 'sub-1',
    organizationId: 'org-1',
    planId: 'plan-1',
    status: 'ACTIVE' as const,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    trialEndsAt: null,
    canceledAt: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new SubscriptionLifecycleService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('activateTrial', () => {
    it('should create a trial subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.organizationSubscription.create as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'TRIAL',
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue({});

      const result = await service.activateTrial('org-1', 'plan-1', 14);

      expect(result.status).toBe('TRIAL');
      expect(prisma.organizationSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            planId: 'plan-1',
            status: 'TRIAL',
          }),
        }),
      );
    });

    it('should throw BadRequestException if subscription exists', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      await expect(service.activateTrial('org-1', 'plan-1', 14)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('activate', () => {
    it('should activate a trial subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'TRIAL',
      });
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'ACTIVE',
      });

      const result = await service.activate('org-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw BadRequestException for invalid transition', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'EXPIRED',
      });

      await expect(service.activate('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel an active subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'CANCELED',
      });

      const result = await service.cancel('org-1');

      expect(result.status).toBe('CANCELED');
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancel('org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renew', () => {
    it('should renew an active subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      });
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'ACTIVE',
      });

      const result = await service.renew('org-1');

      expect(result.status).toBe('ACTIVE');
    });

    it('should throw BadRequestException for expired subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'EXPIRED',
      });

      await expect(service.renew('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('suspend', () => {
    it('should suspend a past_due subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'PAST_DUE',
      });
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'SUSPENDED',
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue({});

      const result = await service.suspend('org-1');

      expect(result.status).toBe('SUSPENDED');
    });

    it('should throw BadRequestException for invalid transition', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'ACTIVE',
      });

      await expect(service.suspend('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('enterGracePeriod', () => {
    it('should move subscription to grace period', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'GRACE_PERIOD',
      });

      const result = await service.enterGracePeriod('org-1');

      expect(result.status).toBe('GRACE_PERIOD');
    });
  });

  describe('expire', () => {
    it('should expire a subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        id: 'sub-1',
        status: 'EXPIRED',
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue({});

      const result = await service.expire('org-1');

      expect(result.status).toBe('EXPIRED');
    });

    it('should return if already expired', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'EXPIRED',
      });

      const result = await service.expire('org-1');

      expect(result.status).toBe('EXPIRED');
      expect(prisma.organizationSubscription.update).not.toHaveBeenCalled();
    });
  });

  describe('processExpiredSubscriptions', () => {
    it('should process expired active subscriptions', async () => {
      (prisma.organizationSubscription.findMany as jest.Mock).mockResolvedValue([
        { organizationId: 'org-1' },
      ]);

      const result = await service.processExpiredSubscriptions();

      expect(result).toBeGreaterThan(0);
    });
  });
});
