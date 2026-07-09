import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { CouponQueryDto } from './dto/coupon-query.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCouponDto) {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: dto.code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = await this.prisma.coupon.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses ?? null,
        maxUsesPerCustomer: dto.maxUsesPerCustomer ?? null,
        currency: dto.currency ?? null,
        minAmount: dto.minAmount ?? null,
        appliesToPlanIds: dto.appliesToPlanIds
          ? JSON.parse(JSON.stringify(dto.appliesToPlanIds))
          : null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });

    this.logger.log(`Coupon created: ${coupon.id} (${coupon.code})`);
    return coupon;
  }

  async findAll(query: CouponQueryDto) {
    const {
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.CouponWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const orderBy: Prisma.CouponOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { usages: true } } },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id, deletedAt: null },
      include: { _count: { select: { usages: true } } },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  async findByCode(code: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code, deletedAt: null },
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id, deletedAt: null },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        maxUses: dto.maxUses,
        maxUsesPerCustomer: dto.maxUsesPerCustomer,
        currency: dto.currency,
        minAmount: dto.minAmount,
        appliesToPlanIds: dto.appliesToPlanIds
          ? JSON.parse(JSON.stringify(dto.appliesToPlanIds))
          : undefined,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isActive: dto.isActive,
      },
    });

    this.logger.log(`Coupon updated: ${id} (${coupon.code})`);
    return updated;
  }

  async softDelete(id: string, userId: string, reason?: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id, deletedAt: null },
    });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.prisma.coupon.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
        deletedByUserId: userId,
        deletedReason: reason ?? null,
      },
    });

    this.logger.log(`Coupon soft-deleted: ${id} (${coupon.code})`);
  }

  async validate(dto: ValidateCouponDto): Promise<{
    valid: boolean;
    coupon?: Record<string, unknown>;
    discountAmount?: number;
    totalAfterDiscount?: number;
    message?: string;
  }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: dto.code, deletedAt: null },
    });

    if (!coupon) {
      return { valid: false, message: 'Coupon not found' };
    }

    if (!coupon.isActive) {
      return { valid: false, message: 'Coupon is inactive' };
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, message: 'Coupon usage limit exhausted' };
    }

    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) {
      return { valid: false, message: 'Coupon is not yet valid' };
    }
    if (coupon.expiresAt && coupon.expiresAt < now) {
      return { valid: false, message: 'Coupon has expired' };
    }

    if (coupon.maxUsesPerCustomer !== null) {
      const usageCount = await this.prisma.couponUsage.count({
        where: {
          couponId: coupon.id,
          organizationId: dto.organizationId,
        },
      });
      if (usageCount >= coupon.maxUsesPerCustomer) {
        return {
          valid: false,
          message: 'Coupon usage limit reached for this customer',
        };
      }
    }

    if (coupon.currency && dto.orderAmount !== undefined) {
      if (coupon.minAmount !== null && dto.orderAmount < coupon.minAmount) {
        return {
          valid: false,
          message: `Minimum order amount of ${coupon.minAmount} ${coupon.currency} required`,
        };
      }
    }

    if (coupon.appliesToPlanIds && dto.planId) {
      const planIds = coupon.appliesToPlanIds as unknown as string[];
      if (!planIds.includes(dto.planId)) {
        return { valid: false, message: 'Coupon does not apply to this plan' };
      }
    }

    const discountAmount = this.calculateDiscount(
      coupon.discountType,
      coupon.discountValue,
      dto.orderAmount ?? 0,
    );
    const totalAfterDiscount = Math.max(0, (dto.orderAmount ?? 0) - discountAmount);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      } as unknown as Record<string, unknown>,
      discountAmount,
      totalAfterDiscount,
    };
  }

  async apply(dto: ApplyCouponDto) {
    const validation = await this.validate({
      code: dto.code,
      organizationId: dto.organizationId,
      orderAmount: dto.orderAmount,
      planId: dto.planId,
    });

    if (!validation.valid) {
      throw new BadRequestException(validation.message);
    }

    if (!validation.coupon) {
      throw new BadRequestException('Coupon validation failed');
    }

    await this.prisma.coupon.update({
      where: { code: dto.code },
      data: { usedCount: { increment: 1 } },
    });

    return {
      couponCode: dto.code,
      discountAmount: validation.discountAmount,
      totalAfterDiscount: validation.totalAfterDiscount,
    };
  }

  async recordUsage(
    couponId: string,
    organizationId: string,
    invoiceId: string,
    discountAmount: number,
  ) {
    const usage = await this.prisma.couponUsage.create({
      data: {
        couponId,
        organizationId,
        invoiceId,
        discountAmount,
      },
    });

    this.logger.log(
      `Coupon usage recorded: ${usage.id} (coupon: ${couponId}, org: ${organizationId})`,
    );
    return usage;
  }

  private calculateDiscount(type: string, value: number, orderAmount: number): number {
    if (type === 'PERCENTAGE') {
      return Math.floor((orderAmount * value) / 100);
    }
    return Math.min(value, orderAmount);
  }
}
