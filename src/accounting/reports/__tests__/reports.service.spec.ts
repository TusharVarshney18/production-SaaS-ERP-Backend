import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ReportsService } from '../reports.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    service = new ReportsService(prisma);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getTrialBalance', () => {
    it('should return aggregated account balances', async () => {
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([
        {
          debit: 5000,
          credit: 0,
          accountId: 'acct-1',
          account: { id: 'acct-1', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET' },
        },
        {
          debit: 0,
          credit: 5000,
          accountId: 'acct-2',
          account: {
            id: 'acct-2',
            accountCode: '4000',
            accountName: 'Revenue',
            accountType: 'REVENUE',
          },
        },
        {
          debit: 2000,
          credit: 0,
          accountId: 'acct-3',
          account: {
            id: 'acct-3',
            accountCode: '5000',
            accountName: 'Rent',
            accountType: 'EXPENSE',
          },
        },
        {
          debit: 0,
          credit: 2000,
          accountId: 'acct-1',
          account: { id: 'acct-1', accountCode: '1000', accountName: 'Cash', accountType: 'ASSET' },
        },
      ]);
      const result = await service.getTrialBalance('org-1');
      expect(result.rows).toHaveLength(3);
      expect(result.totalDebit).toBe(7000);
      expect(result.totalCredit).toBe(7000);
    });
  });

  describe('getBalanceSheet', () => {
    it('should return assets, liabilities, equity', async () => {
      (prisma.chartOfAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'acct-1',
          accountCode: '1000',
          accountName: 'Cash',
          accountType: 'ASSET',
          isActive: true,
        },
        {
          id: 'acct-2',
          accountCode: '2000',
          accountName: 'Loan',
          accountType: 'LIABILITY',
          isActive: true,
        },
        {
          id: 'acct-3',
          accountCode: '3000',
          accountName: 'Capital',
          accountType: 'EQUITY',
          isActive: true,
        },
      ]);
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.getBalanceSheet('org-1');
      expect(result.assets).toBeDefined();
      expect(result.liabilities).toBeDefined();
      expect(result.equity).toBeDefined();
    });
  });

  describe('getProfitAndLoss', () => {
    it('should return revenues, expenses, net profit', async () => {
      (prisma.chartOfAccount.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'acct-4',
          accountCode: '4000',
          accountName: 'Sales',
          accountType: 'REVENUE',
          isActive: true,
        },
        {
          id: 'acct-5',
          accountCode: '5000',
          accountName: 'Rent',
          accountType: 'EXPENSE',
          isActive: true,
        },
      ]);
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([
        { debit: 0, credit: 10000, accountId: 'acct-4' },
        { debit: 3000, credit: 0, accountId: 'acct-5' },
      ]);
      const result = await service.getProfitAndLoss('org-1');
      expect(result.netProfit).toBe(7000);
      expect(result.revenues.total).toBe(10000);
      expect(result.expenses.total).toBe(3000);
    });
  });

  describe('Organization isolation', () => {
    it('should scope trial balance to organizationId', async () => {
      (prisma.journalEntryLine.findMany as jest.Mock).mockResolvedValue([]);
      await service.getTrialBalance('org-1');
      expect(prisma.journalEntryLine.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            journalEntry: expect.objectContaining({ organizationId: 'org-1' }),
          }),
        }),
      );
    });
  });
});
