import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { JournalEntriesService } from '../journal-entries.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('JournalEntriesService', () => {
  let service: JournalEntriesService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new JournalEntriesService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockEntry = {
    id: 'je-1',
    organizationId: 'org-1',
    journalNumber: 'JE-001',
    postingDate: new Date('2026-07-01'),
    description: 'Test entry',
    referenceType: null,
    referenceId: null,
    status: 'DRAFT',
    postedAt: null,
    reversedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [
      {
        id: 'jel-1',
        journalEntryId: 'je-1',
        accountId: 'acct-1',
        debit: 1000,
        credit: 0,
        description: 'Line 1',
        account: { id: 'acct-1', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET' },
      },
      {
        id: 'jel-2',
        journalEntryId: 'je-1',
        accountId: 'acct-2',
        debit: 0,
        credit: 1000,
        description: 'Line 2',
        account: {
          id: 'acct-2',
          accountCode: '4000',
          accountName: 'Revenue',
          accountType: 'REVENUE',
        },
      },
    ],
  };

  const mockAccount1 = {
    id: 'acct-1',
    organizationId: 'org-1',
    accountCode: '1000',
    accountName: 'Cash',
    accountType: 'ASSET',
    isSystem: false,
    isActive: true,
  };
  const mockAccount2 = {
    id: 'acct-2',
    organizationId: 'org-1',
    accountCode: '4000',
    accountName: 'Revenue',
    accountType: 'REVENUE',
    isSystem: false,
    isActive: true,
  };

  describe('create', () => {
    it('should create a balanced journal entry', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValueOnce(mockAccount1);
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValueOnce(mockAccount2);
      (prisma.journalEntry.count as jest.Mock).mockResolvedValue(0);
      (prisma.journalEntry.create as jest.Mock).mockResolvedValue(mockEntry);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        {
          postingDate: '2026-07-01',
          description: 'Test entry',
          lines: [
            { accountId: 'acct-1', debit: 1000, credit: 0 },
            { accountId: 'acct-2', debit: 0, credit: 1000 },
          ],
        },
        'user-1',
        'req-1',
      );
      expect(result.journalNumber).toBe('JE-001');
    });

    it('should throw for unbalanced entry', async () => {
      await expect(
        service.create(
          'org-1',
          {
            postingDate: '2026-07-01',
            lines: [
              { accountId: 'acct-1', debit: 1000, credit: 0 },
              { accountId: 'acct-2', debit: 0, credit: 500 },
            ],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for inactive account', async () => {
      (prisma.chartOfAccount.findFirst as jest.Mock).mockResolvedValue({
        ...mockAccount1,
        isActive: false,
      });
      await expect(
        service.create(
          'org-1',
          {
            postingDate: '2026-07-01',
            lines: [
              { accountId: 'acct-1', debit: 1000, credit: 0 },
              { accountId: 'acct-2', debit: 0, credit: 1000 },
            ],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return journal entry with lines', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(mockEntry);
      const result = await service.findOne('org-1', 'je-1');
      expect(result.id).toBe('je-1');
    });
  });

  describe('post', () => {
    it('should post a draft entry', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(mockEntry);
      (prisma.journalEntry.update as jest.Mock).mockResolvedValue({
        ...mockEntry,
        status: 'POSTED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.post('org-1', 'je-1', 'user-1', 'req-1');
      expect(result.status).toBe('POSTED');
    });

    it('should throw for already posted entry', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        ...mockEntry,
        status: 'POSTED',
      });
      await expect(service.post('org-1', 'je-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('reverse', () => {
    it('should reverse a posted entry', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue({
        ...mockEntry,
        status: 'POSTED',
      });
      (prisma.journalEntry.count as jest.Mock).mockResolvedValue(1);
      (prisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (tx: typeof prisma) => unknown) => {
          const tx = mockDeep<typeof prisma>();
          (tx.journalEntry.create as jest.Mock).mockResolvedValue({
            ...mockEntry,
            id: 'je-2',
            journalNumber: 'JE-002',
            status: 'POSTED',
          });
          (tx.journalEntry.update as jest.Mock).mockResolvedValue({});
          return cb(tx);
        },
      );
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.reverse('org-1', 'je-1', 'Error correction', 'user-1', 'req-1');
      expect(result.status).toBe('POSTED');
    });

    it('should throw for draft entry', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(mockEntry);
      await expect(service.reverse('org-1', 'je-1', null, 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getTrialBalance', () => {
    it('should return trial balance rows', async () => {
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([
        {
          debit: 1000,
          credit: 0,
          accountId: 'acct-1',
          account: { id: 'acct-1', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET' },
        },
        {
          debit: 0,
          credit: 1000,
          accountId: 'acct-2',
          account: {
            id: 'acct-2',
            accountCode: '4000',
            accountName: 'Revenue',
            accountType: 'REVENUE',
          },
        },
      ]);
      const result = await service.getTrialBalance('org-1');
      expect(result.rows).toHaveLength(2);
      expect(result.totalDebit).toBe(1000);
      expect(result.totalCredit).toBe(1000);
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.journalEntry.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'je-1')).rejects.toThrow(NotFoundException);
    });
  });
});
