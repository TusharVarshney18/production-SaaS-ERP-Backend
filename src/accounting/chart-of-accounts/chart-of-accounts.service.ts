import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateChartOfAccountDto } from './dto/create-chart-of-account.dto';
import { UpdateChartOfAccountDto } from './dto/update-chart-of-account.dto';
import { ChartOfAccountQueryDto } from './dto/chart-of-account-query.dto';

@Injectable()
export class ChartOfAccountsService {
  private readonly logger = new Logger(ChartOfAccountsService.name);

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
      resource: 'chart_of_account',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateChartOfAccountDto, userId: string, requestId: string) {
    const existing = await this.prisma.chartOfAccount.findFirst({
      where: { organizationId: orgId, accountCode: dto.accountCode },
    });
    if (existing) throw new ConflictException('Account code already exists');

    if (dto.parentAccountId) {
      const parent = await this.prisma.chartOfAccount.findFirst({
        where: { id: dto.parentAccountId, organizationId: orgId },
      });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    const account = await this.prisma.chartOfAccount.create({
      data: {
        organizationId: orgId,
        accountCode: dto.accountCode,
        accountName: dto.accountName,
        accountType: dto.accountType as never,
        parentAccountId: dto.parentAccountId || null,
        isActive: dto.isActive ?? true,
      },
    });

    await this.log(
      orgId,
      userId,
      'chart_of_account.created',
      'CREATE',
      account.id,
      { accountCode: account.accountCode, accountName: account.accountName },
      requestId,
    );
    return account;
  }

  async findAll(orgId: string, query: ChartOfAccountQueryDto) {
    const {
      search,
      accountType,
      isActive,
      page = 1,
      limit = 50,
      sortBy = 'accountCode',
      sortOrder = 'asc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId };
    if (search) {
      where.OR = [
        { accountName: { contains: search, mode: 'insensitive' } },
        { accountCode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (accountType) where.accountType = accountType;
    if (isActive !== undefined) where.isActive = isActive;

    const [data, total] = await Promise.all([
      this.prisma.chartOfAccount.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: { parentAccount: { select: { id: true, accountCode: true, accountName: true } } },
      }),
      this.prisma.chartOfAccount.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const account = await this.prisma.chartOfAccount.findFirst({
      where: { id, organizationId: orgId },
      include: {
        parentAccount: { select: { id: true, accountCode: true, accountName: true } },
        childAccounts: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            isActive: true,
          },
        },
      },
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateChartOfAccountDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);

    if (dto.accountCode) {
      const existing = await this.prisma.chartOfAccount.findFirst({
        where: { organizationId: orgId, accountCode: dto.accountCode, id: { not: id } },
      });
      if (existing) throw new ConflictException('Account code already exists');
    }

    if (dto.parentAccountId) {
      if (dto.parentAccountId === id)
        throw new BadRequestException('Account cannot be its own parent');
      const parent = await this.prisma.chartOfAccount.findFirst({
        where: { id: dto.parentAccountId, organizationId: orgId },
      });
      if (!parent) throw new NotFoundException('Parent account not found');
    }

    const data: Record<string, unknown> = {};
    if (dto.accountCode !== undefined) data.accountCode = dto.accountCode;
    if (dto.accountName !== undefined) data.accountName = dto.accountName;
    if (dto.accountType !== undefined) data.accountType = dto.accountType;
    if (dto.parentAccountId !== undefined) data.parentAccountId = dto.parentAccountId;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const account = await this.prisma.chartOfAccount.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'chart_of_account.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return account;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    const account = await this.findOne(orgId, id);
    if (account.isSystem) throw new BadRequestException('Cannot delete system account');

    const children = await this.prisma.chartOfAccount.count({ where: { parentAccountId: id } });
    if (children > 0) throw new BadRequestException('Cannot delete account with child accounts');

    const hasTransactions = await this.prisma.journalEntryLine.count({ where: { accountId: id } });
    if (hasTransactions > 0) {
      await this.prisma.chartOfAccount.update({ where: { id }, data: { isActive: false } });
      await this.log(
        orgId,
        userId,
        'chart_of_account.deactivated',
        'UPDATE',
        id,
        { reason: 'Has transactions, deactivated instead' },
        requestId,
      );
      return { message: 'Account has transactions, deactivated instead' };
    }

    await this.prisma.chartOfAccount.delete({ where: { id } });
    await this.log(orgId, userId, 'chart_of_account.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Account deleted' };
  }

  async getAccountBalance(orgId: string, accountId: string) {
    const account = await this.findOne(orgId, accountId);

    const lines = await this.prisma.journalEntryLine.findMany({
      where: {
        accountId,
        journalEntry: { organizationId: orgId, status: 'POSTED' as never },
      },
    });

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

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
  }
}
