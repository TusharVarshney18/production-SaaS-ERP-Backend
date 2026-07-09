import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionLifecycleService } from '../subscription-lifecycle.service';
import { PlanResolver } from '../plan-resolver.service';
import { FeatureResolver } from '../feature-resolver.service';
import { UsageResolver } from '../usage-resolver.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let lifecycle: jest.Mocked<
    Pick<SubscriptionLifecycleService, keyof SubscriptionLifecycleService>
  >;
  let plan: jest.Mocked<Pick<PlanResolver, keyof PlanResolver>>;
  let features: jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;
  let usage: jest.Mocked<Pick<UsageResolver, keyof UsageResolver>>;

  beforeEach(async () => {
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

    plan = {
      resolveActivePlan: jest.fn(),
      resolveBillingCycle: jest.fn(),
      resolveRenewalDate: jest.fn(),
    } as unknown as jest.Mocked<Pick<PlanResolver, keyof PlanResolver>>;

    features = {
      getEnabledFeatures: jest.fn(),
      hasFeature: jest.fn(),
      checkFeature: jest.fn(),
      getFeatureValue: jest.fn(),
      getOrganizationFeatures: jest.fn(),
    } as unknown as jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;

    usage = {
      canUseFeature: jest.fn(),
      incrementUsage: jest.fn(),
      resetUsage: jest.fn(),
      getUsage: jest.fn(),
      checkUsage: jest.fn(),
      getRemainingQuota: jest.fn(),
    } as unknown as jest.Mocked<Pick<UsageResolver, keyof UsageResolver>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SubscriptionLifecycleService, useValue: lifecycle },
        { provide: PlanResolver, useValue: plan },
        { provide: FeatureResolver, useValue: features },
        { provide: UsageResolver, useValue: usage },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose lifecycle service', () => {
    expect(service.lifecycle).toBeDefined();
  });

  it('should expose plan resolver', () => {
    expect(service.plan).toBeDefined();
  });

  it('should expose feature resolver', () => {
    expect(service.features).toBeDefined();
  });

  it('should expose usage resolver', () => {
    expect(service.usage).toBeDefined();
  });

  describe('getCurrentSubscription', () => {
    it('should delegate to plan resolver', async () => {
      const expected = {
        planId: 'plan-1',
        planName: 'Growth',
        planSlug: 'growth',
        billingInterval: 'MONTHLY',
        price: 2900,
        currency: 'USD',
        isActive: true,
      };
      plan.resolveActivePlan.mockResolvedValue(expected);

      const result = await service.getCurrentSubscription('org-1');

      expect(plan.resolveActivePlan).toHaveBeenCalledWith('org-1');
      expect(result).toEqual(expected);
    });
  });

  describe('activateSubscription', () => {
    it('should delegate to lifecycle', async () => {
      lifecycle.activate.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

      const result = await service.activateSubscription('org-1');

      expect(lifecycle.activate).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('cancelSubscription', () => {
    it('should delegate to lifecycle', async () => {
      lifecycle.cancel.mockResolvedValue({ id: 'sub-1', status: 'CANCELED' });

      const result = await service.cancelSubscription('org-1');

      expect(lifecycle.cancel).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('CANCELED');
    });
  });

  describe('renewSubscription', () => {
    it('should delegate to lifecycle', async () => {
      lifecycle.renew.mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

      const result = await service.renewSubscription('org-1');

      expect(lifecycle.renew).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('suspendSubscription', () => {
    it('should delegate to lifecycle', async () => {
      lifecycle.suspend.mockResolvedValue({ id: 'sub-1', status: 'SUSPENDED' });

      const result = await service.suspendSubscription('org-1');

      expect(lifecycle.suspend).toHaveBeenCalledWith('org-1');
      expect(result.status).toBe('SUSPENDED');
    });
  });
});
