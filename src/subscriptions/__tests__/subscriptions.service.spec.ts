import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SubscriptionsService } from '../subscriptions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { ChangePlanDto } from '../dto/change-plan.dto';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
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
    plan: mockPlan,
  };

  const mockOrg = {
    id: 'org-1',
    name: 'Acme Inc.',
    code: 'acme',
    slug: 'acme',
    logoUrl: null,
    domain: null,
    plan: 'FREE' as const,
    status: 'ACTIVE' as const,
    roleVersion: 1,
    trialEndsAt: null,
    settings: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    deletedBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new SubscriptionsService(prisma);
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

      expect(prisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'growth' },
        select: { id: true },
      });
      expect(prisma.subscriptionPlan.create).toHaveBeenCalledWith({
        data: {
          name: 'Growth Plan',
          slug: 'growth',
          description: null,
          billingInterval: 'MONTHLY',
          price: 2900,
          currency: 'USD',
          trialPeriodDays: 0,
          isActive: true,
          sortOrder: 0,
        },
      });
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
      expect(result.meta.page).toBe(1);
    });

    it('should apply search and isActive filters', async () => {
      (prisma.subscriptionPlan.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.subscriptionPlan.count as jest.Mock).mockResolvedValue(0);

      await service.findAllPlans({ search: 'growth', isActive: true });

      const where = (prisma.subscriptionPlan.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.name).toEqual({ contains: 'growth', mode: 'insensitive' });
      expect(where.isActive).toBe(true);
    });
  });

  describe('findPlanById', () => {
    it('should return plan with features', async () => {
      const planWithFeatures = {
        ...mockPlan,
        features: [],
        _count: { subscriptions: 0 },
      };
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(planWithFeatures);

      const result = await service.findPlanById('plan-1');

      expect(result).toEqual(planWithFeatures);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findPlanById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findPlanBySlug', () => {
    it('should return plan by slug', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      const result = await service.findPlanBySlug('growth');

      expect(result).toEqual(mockPlan);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findPlanBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePlan', () => {
    const dto: UpdatePlanDto = { name: 'Growth Plus Plan', price: 3900 };

    it('should update and return plan', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.subscriptionPlan.update as jest.Mock).mockResolvedValue({
        ...mockPlan,
        name: 'Growth Plus Plan',
        price: 3900,
      });

      const result = await service.updatePlan('plan-1', dto);

      expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          name: 'Growth Plus Plan',
          price: 3900,
          description: undefined,
          billingInterval: undefined,
          currency: undefined,
          trialPeriodDays: undefined,
          isActive: undefined,
          sortOrder: undefined,
        },
      });
      expect(result.name).toBe('Growth Plus Plan');
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.updatePlan('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeletePlan', () => {
    it('should soft delete a plan with no active subscriptions', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.organizationSubscription.count as jest.Mock).mockResolvedValue(0);

      await service.softDeletePlan('plan-1', 'user-1', 'Archived');

      expect(prisma.subscriptionPlan.update).toHaveBeenCalledWith({
        where: { id: 'plan-1' },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
          deletedByUserId: 'user-1',
          deletedReason: 'Archived',
        },
      });
    });

    it('should throw BadRequestException if active subscriptions exist', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.organizationSubscription.count as jest.Mock).mockResolvedValue(3);

      await expect(service.softDeletePlan('plan-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.softDeletePlan('nonexistent', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ──────────────────────────────────────────────
  // Subscription Lifecycle
  // ──────────────────────────────────────────────

  describe('activateTrial', () => {
    const dto: CreateSubscriptionDto = { planId: 'plan-1', trialPeriodDays: 14 };

    it('should create a trial subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);
      (prisma.organizationSubscription.create as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organization.update as jest.Mock).mockResolvedValue(mockOrg);

      const result = await service.activateTrial('org-1', dto);

      expect(prisma.organizationSubscription.create).toHaveBeenCalled();
      expect(result).toEqual(mockSubscription);
    });

    it('should throw ConflictException if subscription already exists', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

      await expect(service.activateTrial('org-1', dto)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if plan not found', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);
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

  describe('changePlan', () => {
    const dto: ChangePlanDto = { planId: 'plan-2', immediate: true };
    const targetPlan = {
      ...mockPlan,
      id: 'plan-2',
      slug: 'business',
      name: 'Business Plan',
      sortOrder: 2,
      billingInterval: 'MONTHLY' as const,
    };

    it('should upgrade plan immediately', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(targetPlan);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        plan: targetPlan,
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue(mockOrg);

      const result = await service.changePlan('org-1', dto);

      expect(result.plan.id).toBe('plan-2');
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.changePlan('org-1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already on the target plan', async () => {
      const samePlanDto: ChangePlanDto = { planId: 'plan-1' };
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(mockPlan);

      await expect(service.changePlan('org-1', samePlanDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for immediate downgrade', async () => {
      const downgradePlan = {
        ...mockPlan,
        id: 'plan-0',
        slug: 'free',
        name: 'Free Plan',
        sortOrder: 0,
        billingInterval: 'MONTHLY' as const,
      };
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue(downgradePlan);

      await expect(service.changePlan('org-1', dto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel an active subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELED',
        canceledAt: new Date(),
      });

      const result = await service.cancelSubscription('org-1');

      expect(result.status).toBe('CANCELED');
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.cancelSubscription('org-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if already canceled', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELED',
      });

      await expect(service.cancelSubscription('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('renewSubscription', () => {
    it('should renew a canceled subscription', async () => {
      const canceledSub = {
        ...mockSubscription,
        status: 'CANCELED' as const,
        canceledAt: new Date(),
      };
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(canceledSub);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        ...canceledSub,
        status: 'ACTIVE',
        canceledAt: null,
      });

      const result = await service.renewSubscription('org-1');

      expect(result.status).toBe('ACTIVE');
      expect(result.canceledAt).toBeNull();
    });

    it('should renew an active subscription (extend period)', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue(mockSubscription);

      const result = await service.renewSubscription('org-1');

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if expired', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'EXPIRED',
      });

      await expect(service.renewSubscription('org-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.renewSubscription('org-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('expireSubscription', () => {
    it('should expire an active subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.organizationSubscription.update as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'EXPIRED',
      });
      (prisma.organization.update as jest.Mock).mockResolvedValue(mockOrg);

      const result = await service.expireSubscription('org-1');

      expect(result.status).toBe('EXPIRED');
    });

    it('should return the subscription if already expired', async () => {
      const expiredSub = { ...mockSubscription, status: 'EXPIRED' as const };
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(expiredSub);

      const result = await service.expireSubscription('org-1');

      expect(result.status).toBe('EXPIRED');
    });

    it('should throw NotFoundException if no subscription', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.expireSubscription('org-1')).rejects.toThrow(NotFoundException);
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

    it('should throw BadRequestException if not active', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        ...mockSubscription,
        status: 'CANCELED',
      });

      await expect(service.markPastDue('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleExpiredSubscriptions', () => {
    it('should process expired subscriptions', async () => {
      const expiredOrgId = 'org-expired';
      (prisma.organizationSubscription.findMany as jest.Mock).mockResolvedValue([
        { organizationId: expiredOrgId },
      ]);
      jest.spyOn(service, 'expireSubscription').mockResolvedValue({
        ...mockSubscription,
        organizationId: expiredOrgId,
        status: 'EXPIRED',
      });

      const result = await service.handleExpiredSubscriptions();

      expect(result.processed).toBe(1);
      expect(service.expireSubscription).toHaveBeenCalledWith(expiredOrgId);
    });

    it('should handle errors gracefully', async () => {
      (prisma.organizationSubscription.findMany as jest.Mock).mockResolvedValue([
        { organizationId: 'org-1' },
      ]);
      jest.spyOn(service, 'expireSubscription').mockRejectedValue(new Error('DB error'));

      const result = await service.handleExpiredSubscriptions();

      expect(result.processed).toBe(1);
    });
  });
});
