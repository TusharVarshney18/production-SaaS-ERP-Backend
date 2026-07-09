import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementService } from '../entitlement.service';
import { FeatureResolver } from '../feature-resolver.service';
import { UsageResolver } from '../usage-resolver.service';

describe('EntitlementService', () => {
  let service: EntitlementService;
  let featureResolver: jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;
  let usageResolver: jest.Mocked<Pick<UsageResolver, keyof UsageResolver>>;

  beforeEach(async () => {
    featureResolver = {
      hasFeature: jest.fn(),
      getFeatures: jest.fn(),
      getEnabledFeatures: jest.fn(),
      checkFeature: jest.fn(),
      getFeatureValue: jest.fn(),
      getOrganizationFeatures: jest.fn(),
    } as unknown as jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;

    usageResolver = {
      canUse: jest.fn(),
      canUseFeature: jest.fn(),
      incrementUsage: jest.fn(),
      resetUsage: jest.fn(),
      getUsage: jest.fn(),
      checkUsage: jest.fn(),
      getRemainingQuota: jest.fn(),
    } as unknown as jest.Mocked<Pick<UsageResolver, keyof UsageResolver>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        { provide: FeatureResolver, useValue: featureResolver },
        { provide: UsageResolver, useValue: usageResolver },
      ],
    }).compile();

    service = module.get<EntitlementService>(EntitlementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('can', () => {
    it('should return allowed=true when feature is enabled and within limits', async () => {
      featureResolver.hasFeature.mockResolvedValue(true);
      usageResolver.canUse.mockResolvedValue({
        withinLimits: true,
        current: 5,
        limit: 100,
        remaining: 95,
        message: null,
      });

      const result = await service.can('org-1', 'ai_import_enabled');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
      expect(result.featureSlug).toBe('ai_import_enabled');
      expect(result.metadata).toBeDefined();
    });

    it('should return allowed=false when feature is not enabled', async () => {
      featureResolver.hasFeature.mockResolvedValue(false);

      const result = await service.can('org-1', 'premium_feature');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not available');
      expect(result.reason).toContain('upgrade');
    });

    it('should return allowed=false when usage limit exceeded', async () => {
      featureResolver.hasFeature.mockResolvedValue(true);
      usageResolver.canUse.mockResolvedValue({
        withinLimits: false,
        current: 100,
        limit: 100,
        remaining: 0,
        message: 'Usage limit reached for "import_rows": 100/100',
      });

      const result = await service.can('org-1', 'import_rows');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Usage limit reached');
      expect(result.metadata).toBeDefined();
      expect((result.metadata as Record<string, unknown>).current).toBe(100);
    });

    it('should return unlimited feature as allowed', async () => {
      featureResolver.hasFeature.mockResolvedValue(true);
      usageResolver.canUse.mockResolvedValue({
        withinLimits: true,
        current: 0,
        limit: null,
        remaining: null,
        message: null,
      });

      const result = await service.can('org-1', 'unlimited_feature');

      expect(result.allowed).toBe(true);
      expect(result.metadata).toBeUndefined();
    });

    it('should delegate to FeatureResolver and UsageResolver', async () => {
      featureResolver.hasFeature.mockResolvedValue(true);
      usageResolver.canUse.mockResolvedValue({
        withinLimits: true,
        current: 0,
        limit: null,
        remaining: null,
        message: null,
      });

      await service.can('org-1', 'ai_import_enabled');

      expect(featureResolver.hasFeature).toHaveBeenCalledWith('org-1', 'ai_import_enabled');
      expect(usageResolver.canUse).toHaveBeenCalledWith('org-1', 'ai_import_enabled');
    });
  });

  describe('checkUsage', () => {
    it('should return allowed=true when within limits', async () => {
      featureResolver.hasFeature.mockResolvedValue(true);
      usageResolver.canUse.mockResolvedValue({
        withinLimits: true,
        current: 10,
        limit: 100,
        remaining: 90,
        message: null,
      });

      const result = await service.checkUsage('org-1', 'import_rows');

      expect(result.allowed).toBe(true);
      expect(result.reason).toBeNull();
    });

    it('should return allowed=false when feature missing', async () => {
      featureResolver.hasFeature.mockResolvedValue(false);

      const result = await service.checkUsage('org-1', 'premium');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not available');
    });

    it('should return allowed=false and reason when limit exceeded', async () => {
      featureResolver.hasFeature.mockResolvedValue(true);
      usageResolver.canUse.mockResolvedValue({
        withinLimits: false,
        current: 150,
        limit: 100,
        remaining: 0,
        message: 'Exceeded',
      });

      const result = await service.checkUsage('org-1', 'import_rows');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Exceeded');
    });
  });

  describe('getReason', () => {
    it('should return the reason from an entitlement result', () => {
      const result = {
        allowed: false,
        reason: 'Feature not available',
        featureSlug: 'premium',
      };

      expect(service.getReason(result)).toBe('Feature not available');
    });

    it('should return null when no reason', () => {
      const result = {
        allowed: true,
        reason: null,
        featureSlug: 'basic',
      };

      expect(service.getReason(result)).toBeNull();
    });
  });
});
