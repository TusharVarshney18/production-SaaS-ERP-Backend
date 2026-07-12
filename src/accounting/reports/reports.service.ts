import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getGeneralLedger(
    orgId: string,
    accountId?: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    limit = 50,
  ) {
    const where: Record<string, unknown> = {
      journalEntry: { organizationId: orgId, status: 'POSTED' as never },
    };
    if (accountId) where.accountId = accountId;
    if (dateFrom || dateTo) {
      const postingDate: Record<string, unknown> = {};
      if (dateFrom) postingDate.gte = new Date(dateFrom);
      if (dateTo) postingDate.lte = new Date(dateTo);
      (where.journalEntry as Record<string, unknown>).postingDate = postingDate;
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntryLine.findMany({
        where: where as never,
        orderBy: { journalEntry: { postingDate: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          journalEntry: {
            select: { id: true, journalNumber: true, postingDate: true, description: true },
          },
          account: {
            select: { id: true, accountCode: true, accountName: true, accountType: true },
          },
        },
      }),
      this.prisma.journalEntryLine.count({ where: where as never }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getTrialBalance(orgId: string, asOfDate?: string) {
    const dateFilter = asOfDate ? { lte: new Date(asOfDate) } : {};

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        journalEntry: {
          organizationId: orgId,
          status: 'POSTED' as never,
          ...(asOfDate ? { postingDate: dateFilter } : {}),
        },
      },
      include: {
        account: { select: { id: true, accountCode: true, accountName: true, accountType: true } },
      },
    });

    const accountMap = new Map<
      string,
      { account: (typeof lines)[0]['account']; totalDebit: number; totalCredit: number }
    >();

    for (const line of lines) {
      const key = line.accountId;
      if (!accountMap.has(key)) {
        accountMap.set(key, { account: line.account, totalDebit: 0, totalCredit: 0 });
      }
      const entry = accountMap.get(key)!;
      entry.totalDebit += line.debit;
      entry.totalCredit += line.credit;
    }

    const rows = Array.from(accountMap.values()).map(({ account, totalDebit, totalCredit }) => {
      let balance: number;
      switch (account.accountType) {
        case 'ASSET':
        case 'EXPENSE':
          balance = totalDebit - totalCredit;
          break;
        case 'LIABILITY':
        case 'EQUITY':
        case 'REVENUE':
          balance = totalCredit - totalDebit;
          break;
        default:
          balance = totalDebit - totalCredit;
      }
      return { account, totalDebit, totalCredit, balance };
    });

    const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0);
    const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0);

    return {
      rows,
      totalDebit,
      totalCredit,
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
    };
  }

  async getBalanceSheet(orgId: string, asOfDate?: string) {
    const allAccounts = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: orgId,
        accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] as never[] },
        isActive: true,
      },
      orderBy: { accountCode: 'asc' },
    });

    const trialBalance = await this.getTrialBalance(orgId, asOfDate);
    const accountBalances = new Map(trialBalance.rows.map((r) => [r.account.id, r.balance]));

    const assets = allAccounts
      .filter((a) => a.accountType === 'ASSET')
      .map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: accountBalances.get(a.id) || 0,
      }));
    const liabilities = allAccounts
      .filter((a) => a.accountType === 'LIABILITY')
      .map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: accountBalances.get(a.id) || 0,
      }));
    const equity = allAccounts
      .filter((a) => a.accountType === 'EQUITY')
      .map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: accountBalances.get(a.id) || 0,
      }));

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + l.balance, 0);
    const totalEquity = equity.reduce((s, e) => s + e.balance, 0);

    const netIncome = await this.getNetIncome(orgId, asOfDate);
    const totalLiabilitiesEquity = totalLiabilities + totalEquity + netIncome;

    return {
      asOfDate: asOfDate || new Date().toISOString().split('T')[0],
      assets: { accounts: assets, total: totalAssets },
      liabilities: { accounts: liabilities, total: totalLiabilities },
      equity: { accounts: equity, total: totalEquity },
      netIncome,
      totalLiabilitiesEquity,
    };
  }

  async getProfitAndLoss(orgId: string, dateFrom?: string, dateTo?: string) {
    const allAccounts = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: orgId,
        accountType: { in: ['REVENUE', 'EXPENSE'] as never[] },
        isActive: true,
      },
      orderBy: { accountCode: 'asc' },
    });

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId: { in: allAccounts.map((a) => a.id) },
        journalEntry: {
          organizationId: orgId,
          status: 'POSTED' as never,
          ...(dateFrom ? { postingDate: { gte: new Date(dateFrom) } } : {}),
          ...(dateTo ? { postingDate: { lte: new Date(dateTo) } } : {}),
        },
      },
    });

    const accountBalances = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
      if (!accountBalances.has(line.accountId))
        accountBalances.set(line.accountId, { debit: 0, credit: 0 });
      const b = accountBalances.get(line.accountId)!;
      b.debit += line.debit;
      b.credit += line.credit;
    }

    const revenues = allAccounts
      .filter((a) => a.accountType === 'REVENUE')
      .map((a) => {
        const b = accountBalances.get(a.id) || { debit: 0, credit: 0 };
        return {
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          balance: b.credit - b.debit,
        };
      });
    const expenses = allAccounts
      .filter((a) => a.accountType === 'EXPENSE')
      .map((a) => {
        const b = accountBalances.get(a.id) || { debit: 0, credit: 0 };
        return {
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          balance: b.debit - b.credit,
        };
      });

    const totalRevenue = revenues.reduce((s, r) => s + r.balance, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.balance, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      dateFrom: dateFrom || 'All',
      dateTo: dateTo || 'All',
      revenues: { accounts: revenues, total: totalRevenue },
      expenses: { accounts: expenses, total: totalExpenses },
      netProfit,
    };
  }

  private async getNetIncome(orgId: string, asOfDate?: string): Promise<number> {
    const pnl = await this.getProfitAndLoss(orgId, undefined, asOfDate);
    return pnl.netProfit;
  }
}
