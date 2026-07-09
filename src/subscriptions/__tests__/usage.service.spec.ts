import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UsageService } from '../usage.service';
import { FeatureService } from '../feature.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsageService', () => {
  let service: UsageService;
  let prisma: DeepMockProxy<PrismaService>;
  let featureService: jest.Mocked<Pick<FeatureService, keyof FeatureService>>;

  const mockFeature = {
    id: 'feat-1',
    name: 'Import Rows',
    slug: 'import_rows',
    description: null,
    group: 'imports',
    isActive: true,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    featureService = {
      getFeatureValue: jest.fn(),
      isFeatureEnabled: jest.fn(),
      checkFeature: jest.fn(),
      getOrganizationFeatures: jest.fn(),
    } as unknown as jest.Mocked<Pick<FeatureService, keyof FeatureService>>;

    service = new UsageService(prisma, featureService as unknown as FeatureService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsage', () => {
    it('should return usage counters for an organization', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        id: 'sub-1',
      });
      (prisma.usageCounter.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'uc-1',
          organizationId: 'org-1',
          featureId: 'feat-1',
          period: '2026-07',
          usage: 50,
          softLimit: 80,
          hardLimit: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          feature: mockFeature,
        },
      ]);

      const result = await service.getUsage('org-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        featureSlug: 'import_rows',
        usage: 50,
        softLimit: 80,
        hardLimit: 100,
        remaining: 50,
        withinLimits: true,
        isSoftLimitReached: false,
      });
    });

    it('should throw NotFoundException when no subscription exists', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUsage('org-1')).rejects.toThrow(NotFoundException);
    });

    it('should mark isSoftLimitReached when usage exceeds soft limit', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        id: 'sub-1',
      });
      (prisma.usageCounter.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'uc-1',
          organizationId: 'org-1',
          featureId: 'feat-1',
          period: '2026-07',
          usage: 90,
          softLimit: 80,
          hardLimit: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          feature: mockFeature,
        },
      ]);

      const result = await service.getUsage('org-1');

      expect(result[0].isSoftLimitReached).toBe(true);
      expect(result[0].withinLimits).toBe(true);
    });

    it('should mark withinLimits false when hard limit exceeded', async () => {
      (prisma.organizationSubscription.findUnique as jest.Mock).mockResolvedValue({
        id: 'sub-1',
      });
      (prisma.usageCounter.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'uc-1',
          organizationId: 'org-1',
          featureId: 'feat-1',
          period: '2026-07',
          usage: 150,
          softLimit: null,
          hardLimit: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
          feature: mockFeature,
        },
      ]);

      const result = await service.getUsage('org-1');

      expect(result[0].withinLimits).toBe(false);
      expect(result[0].remaining).toBe(-50);
    });
  });

  describe('checkUsage', () => {
    it('should return withinLimits=true when under limit', async () => {
      featureService.getFeatureValue.mockResolvedValue('100');
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.findUnique as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        usage: 30,
      });

      const result = await service.checkUsage('org-1', 'import_rows');

      expect(result.withinLimits).toBe(true);
      expect(result.current).toBe(30);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(70);
    });

    it('should return withinLimits=false when at limit', async () => {
      featureService.getFeatureValue.mockResolvedValue('100');
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.findUnique as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        usage: 100,
      });

      const result = await service.checkUsage('org-1', 'import_rows');

      expect(result.withinLimits).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.message).toContain('Usage limit reached');
    });

    it('should return unlimited when no limit configured', async () => {
      featureService.getFeatureValue.mockResolvedValue(null);

      const result = await service.checkUsage('org-1', 'import_rows');

      expect(result.withinLimits).toBe(true);
      expect(result.limit).toBeNull();
      expect(result.remaining).toBeNull();
    });

    it('should handle missing counter as zero usage', async () => {
      featureService.getFeatureValue.mockResolvedValue('100');
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.checkUsage('org-1', 'import_rows');

      expect(result.current).toBe(0);
      expect(result.withinLimits).toBe(true);
      expect(result.remaining).toBe(100);
    });
  });

  describe('incrementUsage', () => {
    it('should create a new counter when none exists', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.upsert as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        organizationId: 'org-1',
        featureId: 'feat-1',
        period: '2026-07',
        usage: 5,
        softLimit: null,
        hardLimit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      featureService.getFeatureValue.mockResolvedValue('100');

      const result = await service.incrementUsage('org-1', 'import_rows', 5);

      expect(result.usage).toBe(5);
      expect(result.featureSlug).toBe('import_rows');
    });

    it('should increment an existing counter', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.upsert as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        organizationId: 'org-1',
        featureId: 'feat-1',
        period: '2026-07',
        usage: 15,
        softLimit: null,
        hardLimit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      featureService.getFeatureValue.mockResolvedValue('100');

      const result = await service.incrementUsage('org-1', 'import_rows', 10);

      expect(result.usage).toBe(15);
    });

    it('should throw NotFoundException for unknown feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.incrementUsage('org-1', 'unknown_feature')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should use default amount of 1', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.upsert as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        organizationId: 'org-1',
        featureId: 'feat-1',
        period: '2026-07',
        usage: 1,
        softLimit: null,
        hardLimit: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      featureService.getFeatureValue.mockResolvedValue(null);

      const result = await service.incrementUsage('org-1', 'import_rows');

      expect(result.usage).toBe(1);
    });
  });

  describe('getRemainingQuota', () => {
    it('should return remaining quota', async () => {
      jest.spyOn(service, 'checkUsage').mockResolvedValue({
        withinLimits: true,
        current: 30,
        limit: 100,
        remaining: 70,
        message: null,
      });

      const result = await service.getRemainingQuota('org-1', 'import_rows');

      expect(result).toBe(70);
    });

    it('should return null for unlimited features', async () => {
      jest.spyOn(service, 'checkUsage').mockResolvedValue({
        withinLimits: true,
        current: 30,
        limit: null,
        remaining: null,
        message: null,
      });

      const result = await service.getRemainingQuota('org-1', 'import_rows');

      expect(result).toBeNull();
    });
  });
});
