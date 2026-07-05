import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto) {
    const existingCode = await this.prisma.organization.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existingCode) {
      throw new ConflictException('Organization code already exists');
    }

    const slug = dto.slug || dto.code;

    const existingSlug = await this.prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (existingSlug) {
      throw new ConflictException('Organization slug already exists');
    }

    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        code: dto.code,
        slug,
        logoUrl: dto.logoUrl || null,
        domain: dto.domain || null,
      },
    });

    this.logger.log(`Organization created: ${organization.id} (${organization.code})`);
    return organization;
  }

  async findAll(query: OrganizationQueryDto) {
    const {
      search,
      status,
      plan,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.OrganizationWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      where.status = status;
    }
    if (plan) {
      where.plan = plan;
    }

    const orderBy: Prisma.OrganizationOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
      include: {
        orgSettings: true,
        _count: {
          select: {
            users: { where: { deletedAt: null } },
            roles: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto, _userId?: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        name: dto.name,
        logoUrl: dto.logoUrl,
        domain: dto.domain,
      },
    });

    this.logger.log(`Organization updated: ${id}`);
    return updated;
  }

  async softDelete(id: string, userId: string, reason?: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.prisma.organization.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: userId,
        deletedReason: reason || null,
      },
    });

    this.logger.log(`Organization soft-deleted: ${id}`);
  }

  async restore(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id, deletedAt: { not: null } },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found or not deleted');
    }

    await this.prisma.organization.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedByUserId: null,
        deletedReason: null,
      },
    });

    this.logger.log(`Organization restored: ${id}`);
  }
}
