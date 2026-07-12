import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ChartOfAccountsService } from '../chart-of-accounts.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('ChartOfAccountsService', () => {
  let service: ChartOfAccountsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new ChartOfAccountsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockAccount = {
    id: 'acct-1',
    organizationId: 'org-1',
    accountCode: '1000',
    accountName: 'Cash',
    accountType: 'ASSET',
    parentAccountId: null,
    isSystem: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create an account', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.chartOfAccount.create as jest.Mock).mockResolvedValue(mockAccount);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        { accountCode: '1000', accountName: 'Cash', accountType: 'ASSET' },
        'user-1',
        'req-1',
      );
      expect(result.accountCode).toBe('1000');
    });

    it('should throw ConflictException for duplicate code', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      await expect(
        service.create(
          'org-1',
          { accountCode: '1000', accountName: 'Cash', accountType: 'ASSET' },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated accounts', async () => {
      (prisma.chartOfAccount.findMany as jest.Mock).mockResolvedValue([mockAccount]);
      (prisma.chartOfAccount.count as jest.Mock).mockResolvedValue(1);
      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return account with children', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      const result = await service.findOne('org-1', 'acct-1');
      expect(result.id).toBe('acct-1');
    });
  });

  describe('getAccountBalance', () => {
    it('should calculate balance for asset account', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([
        { debit: 1000, credit: 0 },
        { debit: 500, credit: 0 },
        { debit: 0, credit: 200 },
      ]);
      const result = await service.getAccountBalance('org-1', 'acct-1');
      expect(result.totalDebit).toBe(1500);
      expect(result.totalCredit).toBe(200);
      expect(result.balance).toBe(1300);
    });

    it('should calculate balance for liability account', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue({
        ...mockAccount,
        accountType: 'LIABILITY',
      });
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([
        { debit: 0, credit: 1000 },
        { debit: 200, credit: 0 },
      ]);
      const result = await service.getAccountBalance('org-1', 'acct-1');
      expect(result.balance).toBe(800);
    });
  });

  describe('delete', () => {
    it('should deactivate account with transactions', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue(mockAccount);
      (prisma.chartOfAccount.count as jest.Mock).mockResolvedValue(0); // no children
      (prisma.journalEntryLine.count as jest.Mock).mockResolvedValue(5); // has transactions
      (prisma.chartOfAccount.update as jest.Mock).mockResolvedValue({
        ...mockAccount,
        isActive: false,
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.delete('org-1', 'acct-1', 'user-1', 'req-1');
      expect(result.message).toContain('deactivated');
    });

    it('should throw for system account', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue({
        ...mockAccount,
        isSystem: true,
      });
      await expect(service.delete('org-1', 'acct-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'acct-1')).rejects.toThrow(NotFoundException);
      expect(prisma.chartOfAccount.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-2' }) }),
      );
    });
  });
});
