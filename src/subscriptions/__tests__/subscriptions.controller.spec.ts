import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from '../subscriptions.controller';
import { SubscriptionsService } from '../subscriptions.service';
import { FeatureService } from '../feature.service';
import { UsageService } from '../usage.service';
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
  let featureService: jest.Mocked<Pick<FeatureService, keyof FeatureService>>;
  let usageService: jest.Mocked<Pick<UsageService, keyof UsageService>>;

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

    featureService = {
      getOrganizationFeatures: jest.fn(),
      checkFeature: jest.fn(),
      getFeatureValue: jest.fn(),
      isFeatureEnabled: jest.fn(),
    } as unknown as jest.Mocked<Pick<FeatureService, keyof FeatureService>>;

    usageService = {
      getUsage: jest.fn(),
      checkUsage: jest.fn(),
      incrementUsage: jest.fn(),
      getRemainingQuota: jest.fn(),
    } as unknown as jest.Mocked<Pick<UsageService, keyof UsageService>>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: FeatureService, useValue: featureService },
        { provide: UsageService, useValue: usageService },
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
      const expected = {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      };
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
    it('should call service.cancelSubscription with org', async () => {
      subscriptionsService.cancelSubscription.mockResolvedValue(mockSubscription);

      const result = await controller.cancel('org-1');

      expect(subscriptionsService.cancelSubscription).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('renew', () => {
    it('should call service.renewSubscription with org', async () => {
      subscriptionsService.renewSubscription.mockResolvedValue(mockSubscription);

      const result = await controller.renew('org-1');

      expect(subscriptionsService.renewSubscription).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(mockSubscription);
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
    it('should call featureService.getOrganizationFeatures', async () => {
      const expected: FeatureResult[] = [];
      featureService.getOrganizationFeatures.mockResolvedValue(expected);

      const result = await controller.getFeatures('org-1');

      expect(featureService.getOrganizationFeatures).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(expected);
    });
  });

  describe('checkFeature', () => {
    it('should call featureService.checkFeature with org and dto', async () => {
      const dto: CheckFeatureDto = { featureSlug: 'ai_import_enabled' };
      const expected = { slug: 'ai_import_enabled', enabled: true, value: 'true' };
      featureService.checkFeature.mockResolvedValue(expected);

      const result = await controller.checkFeature('org-1', dto);

      expect(featureService.checkFeature).toHaveBeenCalledWith('org-1', 'ai_import_enabled');
      expect(result).toEqual(expected);
    });
  });

  // ──────────────────────────────────────────────
  // Usage
  // ──────────────────────────────────────────────

  describe('getUsage', () => {
    it('should call usageService.getUsage with org', async () => {
      const expected: UsageResult[] = [];
      usageService.getUsage.mockResolvedValue(expected);

      const result = await controller.getUsage('org-1');

      expect(usageService.getUsage).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(expected);
    });
  });

  describe('checkUsage', () => {
    it('should call usageService.checkUsage with org and feature', async () => {
      const dto: CheckFeatureDto = { featureSlug: 'import_rows' };
      const expected = {
        withinLimits: true,
        current: 10,
        limit: 100,
        remaining: 90,
        message: null,
      };
      usageService.checkUsage.mockResolvedValue(expected);

      const result = await controller.checkUsage('org-1', dto);

      expect(usageService.checkUsage).toHaveBeenCalledWith('org-1', 'import_rows');
      expect(result).toEqual(expected);
    });
  });

  describe('incrementUsage', () => {
    it('should call usageService.incrementUsage with params', async () => {
      const dto: IncrementUsageDto = { featureSlug: 'import_rows', amount: 5 };
      const expected = {
        featureSlug: 'import_rows',
        featureName: 'Import Rows',
        period: '2026-07',
        usage: 5,
        softLimit: null,
        hardLimit: 100,
        remaining: 95,
        withinLimits: true,
        isSoftLimitReached: false,
      };
      usageService.incrementUsage.mockResolvedValue(expected);

      const result = await controller.incrementUsage('org-1', dto);

      expect(usageService.incrementUsage).toHaveBeenCalledWith(
        'org-1',
        'import_rows',
        5,
        undefined,
      );
      expect(result).toEqual(expected);
    });

    it('should default amount to 1 when not provided', async () => {
      const dto: IncrementUsageDto = { featureSlug: 'import_rows' };
      usageService.incrementUsage.mockResolvedValue({
        featureSlug: 'import_rows',
        featureName: 'Import Rows',
        period: '2026-07',
        usage: 1,
        softLimit: null,
        hardLimit: null,
        remaining: null,
        withinLimits: true,
        isSoftLimitReached: false,
      });

      await controller.incrementUsage('org-1', dto);

      expect(usageService.incrementUsage).toHaveBeenCalledWith(
        'org-1',
        'import_rows',
        1,
        undefined,
      );
    });
  });
});
