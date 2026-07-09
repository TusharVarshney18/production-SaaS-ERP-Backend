import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from '../subscriptions.controller';
import { SubscriptionsService } from '../subscriptions.service';
import { FeatureResolver } from '../feature-resolver.service';
import { UsageResolver } from '../usage-resolver.service';
import { CreatePlanDto } from '../dto/create-plan.dto';
import { UpdatePlanDto } from '../dto/update-plan.dto';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { ChangePlanDto } from '../dto/change-plan.dto';
import { CheckFeatureDto } from '../dto/check-feature.dto';
import { IncrementUsageDto } from '../dto/increment-usage.dto';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { FeatureResult } from '../interfaces/feature-result.interface';
import { UsageResult } from '../interfaces/usage-result.interface';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let subscriptionsService: jest.Mocked<Pick<SubscriptionsService, keyof SubscriptionsService>>;
  let featureResolver: jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;
  let usageResolver: jest.Mocked<Pick<UsageResolver, keyof UsageResolver>>;

  const mockJwtPayload: JwtPayload = {
    sub: 'user-1',
    org: 'org-1',
    email: 'admin@acme.com',
    roleVersion: 1,
    sessionId: 'session-1',
  };

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
    features: [],
    _count: { subscriptions: 0 },
  };

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
    plan: { ...mockPlan, features: [] },
  };

  beforeEach(async () => {
    subscriptionsService = {
      createPlan: jest.fn(),
      findAllPlans: jest.fn(),
      findPlanById: jest.fn(),
      findPlanBySlug: jest.fn(),
      updatePlan: jest.fn(),
      softDeletePlan: jest.fn(),
      activateTrial: jest.fn(),
      getSubscription: jest.fn(),
      changePlan: jest.fn(),
      cancelSubscription: jest.fn(),
      renewSubscription: jest.fn(),
      expireSubscription: jest.fn(),
      markPastDue: jest.fn(),
      handleExpiredSubscriptions: jest.fn(),
    } as unknown as jest.Mocked<Pick<SubscriptionsService, keyof SubscriptionsService>>;

    featureResolver = {
      getEnabledFeatures: jest.fn(),
      hasFeature: jest.fn(),
      checkFeature: jest.fn(),
      getFeatureValue: jest.fn(),
      getOrganizationFeatures: jest.fn(),
    } as unknown as jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;

    usageResolver = {
      canUseFeature: jest.fn(),
      incrementUsage: jest.fn(),
      resetUsage: jest.fn(),
      getUsage: jest.fn(),
      checkUsage: jest.fn(),
      getRemainingQuota: jest.fn(),
    } as unknown as jest.Mocked<Pick<UsageResolver, keyof UsageResolver>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: FeatureResolver, useValue: featureResolver },
        { provide: UsageResolver, useValue: usageResolver },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
  });

  // ──────────────────────────────────────────────
  // Plan CRUD
  // ──────────────────────────────────────────────

  describe('createPlan', () => {
    it('should call service.createPlan with DTO', async () => {
      const dto: CreatePlanDto = {
        name: 'Growth Plan',
        slug: 'growth',
        billingInterval: 'MONTHLY',
        price: 2900,
      };
      subscriptionsService.createPlan.mockResolvedValue(mockPlan);

      const result = await controller.createPlan(dto);

      expect(subscriptionsService.createPlan).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPlan);
    });
  });

  describe('findAllPlans', () => {
    it('should call service.findAllPlans with query', async () => {
      const query = { page: 1, limit: 20 };
      const expected = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
      subscriptionsService.findAllPlans.mockResolvedValue(expected);

      const result = await controller.findAllPlans(query);

      expect(subscriptionsService.findAllPlans).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });
  });

  describe('findPlanById', () => {
    it('should call service.findPlanById with id', async () => {
      subscriptionsService.findPlanById.mockResolvedValue(mockPlan);

      const result = await controller.findPlanById('plan-1');

      expect(subscriptionsService.findPlanById).toHaveBeenCalledWith('plan-1');
      expect(result).toEqual(mockPlan);
    });
  });

  describe('updatePlan', () => {
    it('should call service.updatePlan with id and dto', async () => {
      const dto: UpdatePlanDto = { name: 'Updated Plan' };
      subscriptionsService.updatePlan.mockResolvedValue(mockPlan);

      const result = await controller.updatePlan('plan-1', dto);

      expect(subscriptionsService.updatePlan).toHaveBeenCalledWith('plan-1', dto);
      expect(result).toEqual(mockPlan);
    });
  });

  describe('deletePlan', () => {
    it('should call service.softDeletePlan with id and user', async () => {
      subscriptionsService.softDeletePlan.mockResolvedValue(undefined);

      const result = await controller.deletePlan('plan-1', mockJwtPayload);

      expect(subscriptionsService.softDeletePlan).toHaveBeenCalledWith(
        'plan-1',
        'user-1',
        undefined,
      );
      expect(result).toEqual({ message: 'Plan deleted successfully' });
    });
  });

  // ──────────────────────────────────────────────
  // Subscription Lifecycle
  // ──────────────────────────────────────────────

  describe('activateTrial', () => {
    it('should call service.activateTrial with org and dto', async () => {
      const dto: CreateSubscriptionDto = { planId: 'plan-1' };
      subscriptionsService.activateTrial.mockResolvedValue(mockSubscription);

      const result = await controller.activateTrial('org-1', dto);

      expect(subscriptionsService.activateTrial).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('getSubscription', () => {
    it('should call service.getSubscription with org', async () => {
      subscriptionsService.getSubscription.mockResolvedValue(mockSubscription);

      const result = await controller.getSubscription('org-1');

      expect(subscriptionsService.getSubscription).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('changePlan', () => {
    it('should call service.changePlan with org and dto', async () => {
      const dto: ChangePlanDto = { planId: 'plan-2' };
      subscriptionsService.changePlan.mockResolvedValue(mockSubscription);

      const result = await controller.changePlan('org-1', dto);

      expect(subscriptionsService.changePlan).toHaveBeenCalledWith('org-1', dto);
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('cancel', () => {
    it('should delegate to service', async () => {
      subscriptionsService.cancelSubscription.mockResolvedValue({
        id: 'sub-1',
        status: 'CANCELED',
      });

      const result = await controller.cancel('org-1');

      expect(subscriptionsService.cancelSubscription).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('CANCELED');
    });
  });

  describe('renew', () => {
    it('should delegate to service', async () => {
      subscriptionsService.renewSubscription.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

      await controller.renew('org-1');

      expect(subscriptionsService.renewSubscription).toHaveBeenCalledWith('org-1');
    });
  });

  describe('processExpired', () => {
    it('should call service.handleExpiredSubscriptions', async () => {
      const expected = { processed: 0 };
      subscriptionsService.handleExpiredSubscriptions.mockResolvedValue(expected);

      const result = await controller.processExpired();

      expect(subscriptionsService.handleExpiredSubscriptions).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  // ──────────────────────────────────────────────
  // Features
  // ──────────────────────────────────────────────

  describe('getFeatures', () => {
    it('should call featureResolver.getOrganizationFeatures', async () => {
      const expected: FeatureResult[] = [];
      featureResolver.getOrganizationFeatures.mockResolvedValue(expected);

      const result = await controller.getFeatures('org-1');

      expect(featureResolver.getOrganizationFeatures).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(expected);
    });
  });

  describe('checkFeature', () => {
    it('should call featureResolver.checkFeature', async () => {
      const dto: CheckFeatureDto = { featureSlug: 'ai_import_enabled' };
      const expected = { slug: 'ai_import_enabled', enabled: true, value: 'true' };
      featureResolver.checkFeature.mockResolvedValue(expected);

      const result = await controller.checkFeature('org-1', dto);

      expect(featureResolver.checkFeature).toHaveBeenCalledWith('org-1', 'ai_import_enabled');
      expect(result).toEqual(expected);
    });
  });

  // ──────────────────────────────────────────────
  // Usage
  // ──────────────────────────────────────────────

  describe('getUsage', () => {
    it('should call usageResolver.getUsage', async () => {
      const expected: UsageResult[] = [];
      usageResolver.getUsage.mockResolvedValue(expected);

      const result = await controller.getUsage('org-1');

      expect(usageResolver.getUsage).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(expected);
    });
  });

  describe('checkUsage', () => {
    it('should call usageResolver.checkUsage', async () => {
      const dto: CheckFeatureDto = { featureSlug: 'import_rows' };
      const expected = {
        withinLimits: true,
        current: 10,
        limit: 100,
        remaining: 90,
        message: null,
      };
      usageResolver.checkUsage.mockResolvedValue(expected);

      const result = await controller.checkUsage('org-1', dto);

      expect(usageResolver.checkUsage).toHaveBeenCalledWith('org-1', 'import_rows');
      expect(result).toEqual(expected);
    });
  });

  describe('incrementUsage', () => {
    it('should call usageResolver.incrementUsage with params', async () => {
      const dto: IncrementUsageDto = { featureSlug: 'import_rows', amount: 5 };
      const expected = {
        featureSlug: 'import_rows',
        featureName: 'Import Rows',
        period: '2026-07',
        usage: 5,
        softLimit: null,
        hardLimit: null,
        remaining: null,
        withinLimits: true,
        isSoftLimitReached: false,
      };
      usageResolver.incrementUsage.mockResolvedValue(expected);

      const result = await controller.incrementUsage('org-1', dto);

      expect(usageResolver.incrementUsage).toHaveBeenCalledWith(
        'org-1',
        'import_rows',
        5,
        undefined,
      );
      expect(result).toEqual(expected);
    });
  });
});
