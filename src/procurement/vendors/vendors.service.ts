import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

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
      resource: 'vendor',
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  async create(orgId: string, dto: CreateVendorDto, userId: string, requestId: string) {
    const existing = await this.prisma.vendor.findFirst({
      where: { organizationId: orgId, vendorCode: dto.vendorCode, deletedAt: null },
    });
    if (existing) throw new ConflictException('Vendor code already exists');

    const vendor = await this.prisma.vendor.create({
      data: {
        organizationId: orgId,
        vendorCode: dto.vendorCode,
        companyName: dto.companyName,
        contactName: dto.contactName || null,
        email: dto.email || null,
        phone: dto.phone || null,
        taxNumber: dto.taxNumber || null,
        address: dto.address || null,
      },
    });

    await this.log(
      orgId,
      userId,
      'vendor.created',
      'CREATE',
      vendor.id,
      { vendorCode: vendor.vendorCode, companyName: vendor.companyName },
      requestId,
    );
    return vendor;
  }

  async findAll(orgId: string, query: VendorQueryDto) {
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
        { companyName: { contains: search, mode: 'insensitive' } },
        { vendorCode: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { purchaseOrders: true } } },
      }),
      this.prisma.vendor.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async update(orgId: string, id: string, dto: UpdateVendorDto, userId: string, requestId: string) {
    await this.findOne(orgId, id);

    if (dto.vendorCode) {
      const existing = await this.prisma.vendor.findFirst({
        where: {
          organizationId: orgId,
          vendorCode: dto.vendorCode,
          id: { not: id },
          deletedAt: null,
        },
      });
      if (existing) throw new ConflictException('Vendor code already exists');
    }

    const data: Record<string, unknown> = {};
    if (dto.vendorCode !== undefined) data.vendorCode = dto.vendorCode;
    if (dto.companyName !== undefined) data.companyName = dto.companyName;
    if (dto.contactName !== undefined) data.contactName = dto.contactName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.taxNumber !== undefined) data.taxNumber = dto.taxNumber;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.status !== undefined) data.status = dto.status;

    const vendor = await this.prisma.vendor.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'vendor.updated',
      'UPDATE',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return vendor;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    const vendor = await this.findOne(orgId, id);
    const result = await this.prisma.vendor.update({
      where: { id },
      data: { status: 'INACTIVE' as never },
    });
    await this.log(
      orgId,
      userId,
      'vendor.archived',
      'UPDATE',
      id,
      { companyName: vendor.companyName },
      requestId,
    );
    return result;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    const vendor = await this.findOne(orgId, id);
    const result = await this.prisma.vendor.update({
      where: { id },
      data: { status: 'ACTIVE' as never },
    });
    await this.log(
      orgId,
      userId,
      'vendor.restored',
      'UPDATE',
      id,
      { companyName: vendor.companyName },
      requestId,
    );
    return result;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.vendor.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'vendor.deleted', 'DELETE', id, {}, requestId);
    return { message: 'Vendor deleted' };
  }
}
