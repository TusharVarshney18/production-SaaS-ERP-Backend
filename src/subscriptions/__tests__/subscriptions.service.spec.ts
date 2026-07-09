import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SubscriptionsService } from '../subscriptions.service';
import { SubscriptionLifecycleService } from '../subscription-lifecycle.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let prisma: DeepMockProxy<PrismaService>;
  let lifecycle: jest.Mocked<
    Pick<SubscriptionLifecycleService, keyof SubscriptionLifecycleService>
  >;

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
    plan: mockPlan,
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    lifecycle = {
      activateTrial: jest.fn(),
      activate: jest.fn(),
      cancel: jest.fn(),
      renew: jest.fn(),
      suspend: jest.fn(),
      expire: jest.fn(),
      enterGracePeriod: jest.fn(),
      processExpiredSubscriptions: jest.fn(),
    } as unknown as jest.Mocked<
      Pick<SubscriptionLifecycleService, keyof SubscriptionLifecycleService>
    >;

    service = new SubscriptionsService(
      prisma,
      lifecycle as unknown as SubscriptionLifecycleService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────
  // Plan CRUD
  // ──────────────────────────────────────────────

  describe('createPlan', () => {
    const dto: CreatePlanDto = {
      name: 'Growth Plan',
      slug: 'growth',
      billingInterval: 'MONTHLY',
      price: 2900,
    };

    it('should create and return a plan', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.subscriptionPlan.create as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.createPlan(dto);

      expect(result).toEqual(mockPlan);
    });

    it('should throw ConflictException if slug exists', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.createPlan(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllPlans', () => {
    it('should return paginated plans', async () => {
      (prisma.subscriptionPlan.findMany as jest.Mock).mockResolvedValue([mockPlan]);
      (prisma.subscriptionPlan.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAllPlans({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findPlanById', () => {
    it('should return plan with features', async () => {
      const planWithFeatures = { ...mockPlan, features: [], _count: { subscriptions: 0 } };
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(planWithFeatures);

      const result = await service.findPlanById('plan-1');

      expect(result).toEqual(planWithFeatures);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findPlanById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlan', () => {
    const dto: UpdatePlanDto = { name: 'Growth Plus Plan' };

    it('should update and return plan', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.subscriptionPlan.update as jest.Mock).mockResolvedValue({
        ...mockPlan,
        name: 'Growth Plus Plan',
      });

      const result = await service.updatePlan('plan-1', dto);

      expect(result.name).toBe('Growth Plus Plan');
    });
  });

  describe('softDeletePlan', () => {
    it('should soft delete a plan', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.organizationSubscription.count as jest.Mock).mockResolvedValue(0);

      await service.softDeletePlan('plan-1', 'user-1', 'Archived');

      expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: expect.objectContaining({
          isActive: false,
          deletedAt: expect.any(Date),
          deletedByUserId: 'user-1',
        }),
      });
    });

    it('should throw BadRequestException if active subscriptions exist', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.organizationSubscription.count as jest.Mock).mockResolvedValue(3);

      await expect(service.softDeletePlan('plan-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  // ──────────────────────────────────────────────
  // Subscription Lifecycle
  // ──────────────────────────────────────────────

  describe('activateTrial', () => {
    const dto: CreateSubscriptionDto = { planId: 'plan-1', trialPeriodDays: 14 };

    it('should activate a trial via lifecycle service', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      lifecycle.activateTrial.mockResolvedValue({ id: 'sub-1', status: 'TRIAL' });
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.activateTrial('org-1', dto);

      expect(lifecycle.activateTrial).toHaveBeenCalledWith('org-1', 'plan-1', 14);
      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundException if plan not found', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.activateTrial('org-1', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubscription', () => {
    it('should return subscription with plan info', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.getSubscription('org-1');

      expect(result).toEqual(mockSubscription);
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getSubscription('org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancelSubscription', () => {
    it('should delegate to lifecycle service', async () => {
      lifecycle.cancel.mockResolvedValue({ id: 'sub-1', status: 'CANCELED' });

      const result = await service.cancelSubscription('org-1');

      expect(lifecycle.cancel).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('CANCELED');
    });

    it('should pass through lifecycle errors', async () => {
      lifecycle.cancel.mockRejectedValue(new NotFoundException('No subscription found'));

      await expect(service.cancelSubscription('org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('renewSubscription', () => {
    it('should delegate to lifecycle service', async () => {
      lifecycle.renew.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

      const result = await service.renewSubscription('org-1');

      expect(lifecycle.renew).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('expireSubscription', () => {
    it('should delegate to lifecycle service', async () => {
      lifecycle.expire.mockResolvedValue({ id: 'sub-1', status: 'EXPIRED' });

      const result = await service.expireSubscription('org-1');

      expect(lifecycle.expire).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('EXPIRED');
    });
  });

  describe('markPastDue', () => {
    it('should mark active subscription as past_due', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'PAST_DUE',
      });

      const result = await service.markPastDue('org-1');

      expect(result.status).toBe('PAST_DUE');
    });
  });

  describe('handleExpiredSubscriptions', () => {
    it('should delegate to lifecycle service', async () => {
      lifecycle.processExpiredSubscriptions.mockResolvedValue(5);

      const result = await service.handleExpiredSubscriptions();

      expect(lifecycle.processExpiredSubscriptions).toHaveBeenCalled();
      expect(result.processed).toBe(5);
    });
  });
});
