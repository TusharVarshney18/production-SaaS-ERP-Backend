import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { FiscalYearsService } from '../fiscal-years.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('FiscalYearsService', () => {
  let service: FiscalYearsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new FiscalYearsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockFY = {
    id: 'fy-1',
    organizationId: 'org-1',
    name: 'FY 2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    isClosed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    periods: [],
  };

  describe('create', () => {
    it('should create a fiscal year', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.fiscalYear.create as jest.Mock).mockResolvedValue(mockFY);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        { name: 'FY 2026', startDate: '2026-01-01', endDate: '2026-12-31' },
        'user-1',
        'req-1',
      );
      expect(result.name).toBe('FY 2026');
    });

    it('should throw ConflictException for duplicate name', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue(mockFY);
      await expect(
        service.create(
          'org-1',
          { name: 'FY 2026', startDate: '2026-01-01', endDate: '2026-12-31' },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return fiscal year', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue(mockFY);
      const result = await service.findOne('org-1', 'fy-1');
      expect(result.name).toBe('FY 2026');
    });
  });

  describe('close', () => {
    it('should close fiscal year', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue(mockFY);
      (prisma.journalEntry.count as jest.Mock).mockResolvedValue(0);
      (prisma.accountingPeriod.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.fiscalYear.update as jest.Mock).mockResolvedValue({ ...mockFY, isClosed: true });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.close('org-1', 'fy-1', 'user-1', 'req-1');
      expect(result.isClosed).toBe(true);
    });

    it('should throw if already closed', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue({ ...mockFY, isClosed: true });
      await expect(service.close('org-1', 'fy-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if draft entries exist', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue(mockFY);
      (prisma.journalEntry.count as jest.Mock).mockResolvedValue(3);
      await expect(service.close('org-1', 'fy-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.fiscalYear.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'fy-1')).rejects.toThrow(NotFoundException);
    });
  });
});
