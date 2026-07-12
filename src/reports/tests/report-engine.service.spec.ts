import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ReportEngineService } from '../services/report-engine.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportEngineService', () => {
  let service: ReportEngineService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ReportEngineService(prisma);
  });

  describe('buildDateFilter', () => {
    it('should return undefined when no dates', () => {
      expect(service.buildDateFilter()).toBeUndefined();
    });

    it('should return date range filter', () => {
      const result = service.buildDateFilter('2026-01-01', '2026-12-31');
      expect(result).toBeDefined();
      expect((result as Record<string, unknown>).gte).toBeInstanceOf(Date);
      expect((result as Record<string, unknown>).lte).toBeInstanceOf(Date);
    });
  });

  describe('getPagination', () => {
    it('should calculate skip and take', () => {
      const result = service.getPagination(2, 10);
      expect(result.skip).toBe(10);
      expect(result.take).toBe(10);
      expect(result.page).toBe(2);
    });
  });

  describe('getPeriodOverPeriod', () => {
    it('should calculate change and trend', async () => {
      const mockAggregate = jest.fn();
      mockAggregate.mockResolvedValueOnce({ _sum: { grandTotal: 15000 } });
      mockAggregate.mockResolvedValueOnce({ _sum: { grandTotal: 10000 } });
      (prisma as unknown as Record<string, unknown>).salesOrder = { aggregate: mockAggregate };

      const result = await service.getPeriodOverPeriod(
        'org-1',
        new Date('2026-07-01'),
        new Date('2026-07-31'),
        new Date('2026-06-01'),
        new Date('2026-06-30'),
        'salesOrder',
        'grandTotal',
      );
      expect(result.current).toBe(15000);
      expect(result.previous).toBe(10000);
      expect(result.change).toBe(50);
      expect(result.trend).toBe('up');
    });
  });

  describe('Status distribution', () => {
    it('should group by status field', async () => {
      (prisma as unknown as Record<string, unknown>).salesOrder = {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'DRAFT', _count: { id: 5 } },
          { status: 'APPROVED', _count: { id: 3 } },
        ]),
      };
      const result = await service.getStatusDistribution('org-1', 'salesOrder', 'status');
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('DRAFT');
      expect(result[0].value).toBe(5);
    });
  });
});
