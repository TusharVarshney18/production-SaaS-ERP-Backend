import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';

@Injectable()
export class JournalEntriesService {
  private readonly logger = new Logger(JournalEntriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async log(
    orgId: string,
    actorId: string,
    event: string,
    action: string,
    resourceId: string,
    details: Record<string, unknown>,
    requestId: string,
  ) {
    await this.auditLog.create({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      event,
      resource: 'journal_entry',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  private async generateJournalNumber(orgId: string): Promise<string> {
    const count = await this.prisma.journalEntry.count({ where: { organizationId: orgId } });
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    return `JE-${datePart}-${(count + 1).toString().padStart(4, '0')}`;
  }

  private validateLines(lines: { debit: number; credit: number }[]) {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    if (totalDebit !== totalCredit) {
      throw new BadRequestException(`Debits (${totalDebit}) must equal credits (${totalCredit})`);
    }
    const allZero = lines.every((l) => l.debit === 0 && l.credit === 0);
    if (allZero) throw new BadRequestException('At least one line must have a non-zero amount');
    const invalidLine = lines.some((l) => l.debit > 0 && l.credit > 0);
    if (invalidLine) throw new BadRequestException('A line cannot have both debit and credit');
  }

  async create(orgId: string, dto: CreateJournalEntryDto, userId: string, requestId: string) {
    this.validateLines(dto.lines);

    for (const line of dto.lines) {
      const account = await this.prisma.chartOfAccount.findFirst({
        where: { id: line.accountId, organizationId: orgId },
      });
      if (!account) throw new NotFoundException(`Account ${line.accountId} not found`);
      if (!account.isActive)
        throw new BadRequestException(`Account ${account.accountCode} is inactive`);
    }

    const journalNumber = await this.generateJournalNumber(orgId);

    const entry = await this.prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        journalNumber,
        postingDate: new Date(dto.postingDate),
        description: dto.description || null,
        referenceType: dto.referenceType || null,
        referenceId: dto.referenceId || null,
        lines: {
          create: dto.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description || null,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { id: true, accountCode: true, accountName: true } } },
        },
      },
    });

    await this.log(
      orgId,
      userId,
      'journal_entry.created',
      'CREATE',
      entry.id,
      { journalNumber, lineCount: dto.lines.length },
      requestId,
    );
    return entry;
  }

  async findAll(orgId: string, query: JournalEntryQueryDto) {
    const {
      search,
      status,
      referenceType,
      referenceId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (status) where.status = status;
    if (referenceType) where.referenceType = referenceType;
    if (referenceId) where.referenceId = referenceId;
    if (search) where.journalNumber = { contains: search, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.postingDate = {};
      if (dateFrom) (where.postingDate as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.postingDate as Record<string, unknown>).lte = new Date(dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { lines: true } } },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, organizationId: orgId },
      include: {
        lines: {
          include: {
            account: {
              select: { id: true, accountCode: true, accountName: true, accountType: true },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!entry) throw new NotFoundException('Journal entry not found');
    return entry;
  }

  async post(orgId: string, id: string, userId: string, requestId: string) {
    const entry = await this.findOne(orgId, id);
    if (entry.status !== 'DRAFT')
      throw new BadRequestException(`Cannot post entry in status: ${entry.status}`);

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'POSTED', postedAt: new Date() },
      include: {
        lines: {
          include: { account: { select: { id: true, accountCode: true, accountName: true } } },
        },
      },
    });

    await this.log(
      orgId,
      userId,
      'journal_entry.posted',
      'UPDATE',
      id,
      { journalNumber: entry.journalNumber },
      requestId,
    );
    return updated;
  }

  async reverse(
    orgId: string,
    id: string,
    reason: string | null,
    userId: string,
    requestId: string,
  ) {
    const entry = await this.findOne(orgId, id);
    if (entry.status !== 'POSTED')
      throw new BadRequestException('Only posted entries can be reversed');

    const reversingLines = entry.lines.map((l) => ({
      accountId: l.accountId,
      debit: l.credit,
      credit: l.debit,
      description: `Reversal: ${l.description || entry.description || entry.journalNumber}`,
    }));

    const journalNumber = await this.generateJournalNumber(orgId);

    const result = await this.prisma.$transaction(async (tx) => {
      const reversal = await tx.journalEntry.create({
        data: {
          organizationId: orgId,
          journalNumber,
          postingDate: new Date(),
          description: `Reversal of ${entry.journalNumber}: ${reason || 'No reason given'}`,
          status: 'POSTED',
          postedAt: new Date(),
          referenceType: 'Reversal',
          referenceId: id,
          lines: { create: reversingLines },
        },
      });

      await tx.journalEntry.update({
        where: { id },
        data: { status: 'REVERSED', reversedAt: new Date() },
      });

      return reversal;
    });

    await this.log(
      orgId,
      userId,
      'journal_entry.reversed',
      'UPDATE',
      id,
      { reversalJournalNumber: journalNumber, reason: reason || null },
      requestId,
    );
    return result;
  }

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
      where.journalEntry = {
        ...(where.journalEntry as Record<string, unknown>),
        postingDate: {},
      };
      if (dateFrom)
        (
          (where.journalEntry as Record<string, unknown>).postingDate as Record<string, unknown>
        ).gte = new Date(dateFrom);
      if (dateTo)
        (
          (where.journalEntry as Record<string, unknown>).postingDate as Record<string, unknown>
        ).lte = new Date(dateTo);
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

    return { rows, totalDebit, totalCredit, asOfDate: asOfDate || new Date().toISOString() };
  }
}
