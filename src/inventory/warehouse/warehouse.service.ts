import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehouseQueryDto } from './dto/warehouse-query.dto';

@Injectable()
export class WarehouseService {
  private readonly logger = new Logger(WarehouseService.name);

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
      resource: 'warehouse',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateWarehouseDto, userId: string, requestId: string) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { organizationId: orgId, code: dto.code, deletedAt: null },
    });
    if (existing) throw new ConflictException('Warehouse code already exists');

    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { organizationId: orgId, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const warehouse = await this.prisma.warehouse.create({
      data: {
        organizationId: orgId,
        code: dto.code,
        name: dto.name,
        description: dto.description || null,
        address: dto.address || null,
        managerId: dto.managerId || null,
        isDefault: dto.isDefault ?? false,
      },
    });

    await this.log(
      orgId,
      userId,
      'warehouse.created',
      'CREATE',
      warehouse.id,
      { code: warehouse.code, name: warehouse.name },
      requestId,
    );
    return warehouse;
  }

  async findAll(orgId: string, query: WarehouseQueryDto) {
    const {
      search,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.warehouse.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    return warehouse;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateWarehouseDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);

    if (dto.code) {
      const existing = await this.prisma.warehouse.findFirst({
        where: { organizationId: orgId, code: dto.code, id: { not: id }, deletedAt: null },
      });
      if (existing) throw new ConflictException('Warehouse code already exists');
    }

    if (dto.isDefault) {
      await this.prisma.warehouse.updateMany({
        where: { organizationId: orgId, isDefault: true, id: { not: id }, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.managerId !== undefined) data.managerId = dto.managerId;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.status !== undefined) data.status = dto.status;

    const warehouse = await this.prisma.warehouse.update({ where: { id }, data });

    await this.log(
      orgId,
      userId,
      'warehouse.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return warehouse;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    const warehouse = await this.findOne(orgId, id);
    const result = await this.prisma.warehouse.update({
      where: { id },
      data: { status: 'INACTIVE' as never },
    });
    await this.log(
      orgId,
      userId,
      'warehouse.archived',
      'UPDATE',
      id,
      { name: warehouse.name },
      requestId,
    );
    return result;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    const warehouse = await this.findOne(orgId, id);
    const result = await this.prisma.warehouse.update({
      where: { id },
      data: { status: 'ACTIVE' as never },
    });
    await this.log(
      orgId,
      userId,
      'warehouse.restored',
      'UPDATE',
      id,
      { name: warehouse.name },
      requestId,
    );
    return result;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.warehouse.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'warehouse.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Warehouse deleted' };
  }

  async getDefault(orgId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { organizationId: orgId, isDefault: true, status: 'ACTIVE' as never, deletedAt: null },
    });
    if (!warehouse) throw new NotFoundException('No default warehouse found');
    return warehouse;
  }
}
