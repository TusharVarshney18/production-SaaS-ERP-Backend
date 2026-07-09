import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { UsageResolver } from '../usage-resolver.service';
import { FeatureResolver } from '../feature-resolver.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('UsageResolver', () => {
  let service: UsageResolver;
  let prisma: DeepMockProxy<PrismaService>;
  let featureResolver: jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;

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
    featureResolver = {
      getFeatureValue: jest.fn(),
      hasFeature: jest.fn(),
      checkFeature: jest.fn(),
      getEnabledFeatures: jest.fn(),
      getOrganizationFeatures: jest.fn(),
    } as unknown as jest.Mocked<Pick<FeatureResolver, keyof FeatureResolver>>;

    service = new UsageResolver(prisma, featureResolver as unknown as FeatureResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canUseFeature', () => {
    it('should return true when under limit', async () => {
      featureResolver.getFeatureValue.mockResolvedValue('100');
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.findUnique as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        usage: 30,
      });

      const result = await service.canUseFeature('org-1', 'import_rows');

      expect(result.withinLimits).toBe(true);
      expect(result.remaining).toBe(70);
    });

    it('should return false when at limit', async () => {
      featureResolver.getFeatureValue.mockResolvedValue('100');
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.findUnique as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        usage: 100,
      });

      const result = await service.canUseFeature('org-1', 'import_rows');

      expect(result.withinLimits).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });

  describe('resetUsage', () => {
    it('should delete usage counters for a feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await service.resetUsage('org-1', 'import_rows');

      expect(prisma.usageCounter.deleteMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          featureId: 'feat-1',
          period: expect.any(String),
        },
      });
    });

    it('should throw NotFoundException for unknown feature', async () => {
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resetUsage('org-1', 'unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('incrementUsage', () => {
    it('should increment and return usage', async () => {
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
      featureResolver.getFeatureValue.mockResolvedValue('100');

      const result = await service.incrementUsage('org-1', 'import_rows', 5);

      expect(result.usage).toBe(5);
      expect(result.featureSlug).toBe('import_rows');
    });
  });

  describe('getRemainingQuota', () => {
    it('should return remaining quota', async () => {
      featureResolver.getFeatureValue.mockResolvedValue('100');
      (prisma.feature.findUnique as jest.Mock).mockResolvedValue(mockFeature);
      (prisma.usageCounter.findUnique as jest.Mock).mockResolvedValue({
        id: 'uc-1',
        usage: 30,
      });

      const result = await service.getRemainingQuota('org-1', 'import_rows');

      expect(result).toBe(70);
    });
  });
});
