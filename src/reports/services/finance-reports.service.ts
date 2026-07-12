import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportEngineService, ReportQuery, PaginatedResult } from './report-engine.service';

@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: ReportEngineService,
  ) {}

  async getJournalReport(
    orgId: string,
    query: ReportQuery,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const orderBy = this.engine.getOrderBy(query.sortBy, query.sortOrder);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = { organizationId: orgId };
    if (dateFilter) where.postingDate = dateFilter;
    if (query.status) where.status = query.status;
    if (query.search)
      where.OR = this.engine.buildSearchFilter(query.search, ['journalNumber', 'description']);
    const dataPromise = this.prisma.journalEntry.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        lines: { include: { account: { select: { accountCode: true, accountName: true } } } },
      },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.journalEntry.count({ where });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
  }

  async getGeneralLedgerReport(orgId: string, query: ReportQuery) {
    const { skip, take, page, limit } = this.engine.getPagination(query.page, query.limit);
    const dateFilter = this.engine.buildDateFilter(query.dateFrom, query.dateTo);
    const where: Record<string, unknown> = {
      journalEntry: { organizationId: orgId, status: 'POSTED' as never },
    };
    if (dateFilter)
      where.journalEntry = {
        ...(where.journalEntry as Record<string, unknown>),
        postingDate: dateFilter,
      };
    const dataPromise = this.prisma.journalEntryLine.findMany({
      where: where as never,
      orderBy: { journalEntry: { postingDate: 'asc' } },
      skip,
      take,
      include: {
        journalEntry: { select: { journalNumber: true, postingDate: true, description: true } },
        account: { select: { accountCode: true, accountName: true, accountType: true } },
      },
    }) as Promise<Record<string, unknown>[]>;
    const countPromise = this.prisma.journalEntryLine.count({ where: where as never });
    return this.engine.paginate(Promise.all([dataPromise, countPromise]), { page, limit });
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
      if (!accountMap.has(line.accountId))
        accountMap.set(line.accountId, { account: line.account, totalDebit: 0, totalCredit: 0 });
      const e = accountMap.get(line.accountId)!;
      e.totalDebit += line.debit;
      e.totalCredit += line.credit;
    }
    const rows = Array.from(accountMap.values()).map(({ account, totalDebit, totalCredit }) => {
      const balance = ['ASSET', 'EXPENSE'].includes(account.accountType)
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;
      return { account, totalDebit, totalCredit, balance };
    });
    return {
      rows,
      totalDebit: rows.reduce((s, r) => s + r.totalDebit, 0),
      totalCredit: rows.reduce((s, r) => s + r.totalCredit, 0),
    };
  }

  async getProfitAndLoss(orgId: string, dateFrom?: string, dateTo?: string) {
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: orgId,
        accountType: { in: ['REVENUE', 'EXPENSE'] as never[] },
        isActive: true,
      },
    });
    const dateFilter = this.engine.buildDateFilter(dateFrom, dateTo);
    const where: Record<string, unknown> = {
      accountId: { in: accounts.map((a) => a.id) },
      journalEntry: { organizationId: orgId, status: 'POSTED' as never },
    };
    if (dateFilter)
      where.journalEntry = {
        ...(where.journalEntry as Record<string, unknown>),
        postingDate: dateFilter,
      };
    const lines = await this.prisma.journalEntryLine.findMany({ where: where as never });
    const balances = new Map<string, { debit: number; credit: number }>();
    for (const line of lines) {
      if (!balances.has(line.accountId)) balances.set(line.accountId, { debit: 0, credit: 0 });
      const b = balances.get(line.accountId)!;
      b.debit += line.debit;
      b.credit += line.credit;
    }
    const revenues = accounts
      .filter((a) => a.accountType === 'REVENUE')
      .map((a) => {
        const b = balances.get(a.id) || { debit: 0, credit: 0 };
        return {
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          balance: b.credit - b.debit,
        };
      });
    const expenses = accounts
      .filter((a) => a.accountType === 'EXPENSE')
      .map((a) => {
        const b = balances.get(a.id) || { debit: 0, credit: 0 };
        return {
          id: a.id,
          accountCode: a.accountCode,
          accountName: a.accountName,
          balance: b.debit - b.credit,
        };
      });
    return {
      revenues: { accounts: revenues, total: revenues.reduce((s, r) => s + r.balance, 0) },
      expenses: { accounts: expenses, total: expenses.reduce((s, e) => s + e.balance, 0) },
      netProfit:
        revenues.reduce((s, r) => s + r.balance, 0) - expenses.reduce((s, e) => s + e.balance, 0),
    };
  }

  async getBalanceSheet(orgId: string, asOfDate?: string) {
    const pnl = await this.getProfitAndLoss(orgId, undefined, asOfDate);
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        organizationId: orgId,
        accountType: { in: ['ASSET', 'LIABILITY', 'EQUITY'] as never[] },
        isActive: true,
      },
      orderBy: { accountCode: 'asc' },
    });
    const trialBalance = await this.getTrialBalance(orgId, asOfDate);
    const balanceMap = new Map(trialBalance.rows.map((r) => [r.account.id, r.balance]));
    const assets = accounts
      .filter((a) => a.accountType === 'ASSET')
      .map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: balanceMap.get(a.id) || 0,
      }));
    const liabilities = accounts
      .filter((a) => a.accountType === 'LIABILITY')
      .map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: balanceMap.get(a.id) || 0,
      }));
    const equity = accounts
      .filter((a) => a.accountType === 'EQUITY')
      .map((a) => ({
        id: a.id,
        accountCode: a.accountCode,
        accountName: a.accountName,
        balance: balanceMap.get(a.id) || 0,
      }));
    return {
      assets: { accounts: assets, total: assets.reduce((s, a) => s + a.balance, 0) },
      liabilities: { accounts: liabilities, total: liabilities.reduce((s, l) => s + l.balance, 0) },
      equity: { accounts: equity, total: equity.reduce((s, e) => s + e.balance, 0) },
      netIncome: pnl.netProfit,
      totalLiabilitiesEquity:
        liabilities.reduce((s, l) => s + l.balance, 0) +
        equity.reduce((s, e) => s + e.balance, 0) +
        pnl.netProfit,
    };
  }

  async getOutstandingInvoices(orgId: string) {
    const result = await this.prisma.salesInvoice.aggregate({
      where: {
        organizationId: orgId,
        paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as never[] },
      },
      _sum: { balanceDue: true },
    });
    return result._sum.balanceDue || 0;
  }
}
