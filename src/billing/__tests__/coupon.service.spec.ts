import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { CouponService } from '../coupon.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCouponDto } from '../dto/create-coupon.dto';
import { UpdateCouponDto } from '../dto/update-coupon.dto';

describe('CouponService', () => {
  let service: CouponService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockCoupon = {
    id: 'coup-1',
    code: 'SUMMER2026',
    name: 'Summer Sale 2026',
    description: null,
    discountType: 'PERCENTAGE' as const,
    discountValue: 20,
    maxUses: 100,
    usedCount: 0,
    maxUsesPerCustomer: 1,
    currency: null,
    minAmount: null,
    appliesToPlanIds: null,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new CouponService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateCouponDto = {
      code: 'SUMMER2026',
      name: 'Summer Sale 2026',
      discountType: 'PERCENTAGE',
      discountValue: 20,
    };

    it('should create a coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.coupon.create as jest.Mock).mockResolvedValue(mockCoupon);

      const result = await service.create(dto);

      expect(prisma.coupon.create).toHaveBeenCalled();
      expect(result).toEqual(mockCoupon);
    });

    it('should throw ConflictException if code exists', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should create with optional fields', async () => {
      const fullDto: CreateCouponDto = {
        code: 'WELCOME50',
        name: 'Welcome 50',
        discountType: 'FIXED_AMOUNT',
        discountValue: 5000,
        maxUses: 50,
        maxUsesPerCustomer: 1,
        currency: 'USD',
        minAmount: 10000,
        appliesToPlanIds: ['plan-1', 'plan-2'],
        startsAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-12-31T23:59:59Z',
        isActive: true,
      };
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.coupon.create as jest.Mock).mockResolvedValue(mockCoupon);

      await service.create(fullDto);

      const createCall = (prisma.coupon.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.code).toBe('WELCOME50');
      expect(createCall.data.name).toBe('Welcome 50');
      expect(createCall.data.discountType).toBe('FIXED_AMOUNT');
      expect(createCall.data.discountValue).toBe(5000);
      expect(createCall.data.maxUses).toBe(50);
      expect(createCall.data.maxUsesPerCustomer).toBe(1);
      expect(createCall.data.currency).toBe('USD');
      expect(createCall.data.minAmount).toBe(10000);
      expect(createCall.data.appliesToPlanIds).toEqual(['plan-1', 'plan-2']);
      expect(createCall.data.startsAt).toBeInstanceOf(Date);
      expect(createCall.data.expiresAt).toBeInstanceOf(Date);
      expect(createCall.data.isActive).toBe(true);
    });
  });

  describe('findAll', () => {
    it('should return paginated coupons', async () => {
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([mockCoupon]);
      (prisma.coupon.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply search filter', async () => {
      (prisma.coupon.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.coupon.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ search: 'SUMMER' });

      const where = (prisma.coupon.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });
  });

  describe('findById', () => {
    it('should return coupon with usage count', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        _count: { usages: 5 },
      });

      const result = await service.findById('coup-1');

      expect(result._count.usages).toBe(5);
    });

    it('should throw if not found', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const dto: UpdateCouponDto = { name: 'Updated Name' };

    it('should update a coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);
      (prisma.coupon.update as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        name: 'Updated Name',
      });

      const result = await service.update('coup-1', dto);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw if not found', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.update('nonexistent', dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);

      await service.softDelete('coup-1', 'user-1', 'No longer needed');

      expect(prisma.coupon.update).toHaveBeenCalledWith({
        where: { id: 'coup-1' },
        data: {
          isActive: false,
          deletedAt: expect.any(Date),
          deletedByUserId: 'user-1',
          deletedReason: 'No longer needed',
        },
      });
    });

    it('should throw if not found', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.softDelete('nonexistent', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validate', () => {
    it('should validate a valid coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);

      const result = await service.validate({
        code: 'SUMMER2026',
        organizationId: 'org-1',
        orderAmount: 5000,
      });

      expect(result.valid).toBe(true);
      expect(result.discountAmount).toBe(1000);
      expect(result.totalAfterDiscount).toBe(4000);
    });

    it('should return invalid for non-existent coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validate({
        code: 'INVALID',
        organizationId: 'org-1',
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon not found');
    });

    it('should return invalid for inactive coupon', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        isActive: false,
      });

      const result = await service.validate({
        code: 'SUMMER2026',
        organizationId: 'org-1',
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon is inactive');
    });

    it('should return invalid if usage limit exhausted', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue({
        ...mockCoupon,
        maxUses: 100,
        usedCount: 100,
      });

      const result = await service.validate({
        code: 'SUMMER2026',
        organizationId: 'org-1',
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon usage limit exhausted');
    });

    it('should return invalid if per-customer limit reached', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);
      (prisma.couponUsage.count as jest.Mock).mockResolvedValue(1);

      const result = await service.validate({
        code: 'SUMMER2026',
        organizationId: 'org-1',
      });

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Coupon usage limit reached for this customer');
    });

    it('should calculate fixed amount discount correctly', async () => {
      const fixedCoupon = {
        ...mockCoupon,
        discountType: 'FIXED_AMOUNT' as const,
        discountValue: 500,
      };
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(fixedCoupon);

      const result = await service.validate({
        code: 'SUMMER2026',
        organizationId: 'org-1',
        orderAmount: 2900,
      });

      expect(result.discountAmount).toBe(500);
      expect(result.totalAfterDiscount).toBe(2400);
    });

    it('should cap fixed discount at order amount', async () => {
      const fixedCoupon = {
        ...mockCoupon,
        discountType: 'FIXED_AMOUNT' as const,
        discountValue: 5000,
      };
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(fixedCoupon);

      const result = await service.validate({
        code: 'SUMMER2026',
        organizationId: 'org-1',
        orderAmount: 2000,
      });

      expect(result.discountAmount).toBe(2000);
      expect(result.totalAfterDiscount).toBe(0);
    });
  });

  describe('apply', () => {
    it('should validate and increment usage count', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);
      (prisma.coupon.update as jest.Mock).mockResolvedValue({ ...mockCoupon, usedCount: 1 });

      const result = await service.apply({
        code: 'SUMMER2026',
        organizationId: 'org-1',
        orderAmount: 5000,
      });

      expect(result.discountAmount).toBe(1000);
      expect(result.totalAfterDiscount).toBe(4000);
    });

    it('should throw if validation fails', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.apply({
          code: 'INVALID',
          organizationId: 'org-1',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordUsage', () => {
    it('should create a usage record', async () => {
      const mockUsage = {
        id: 'usage-1',
        couponId: 'coup-1',
        organizationId: 'org-1',
        invoiceId: 'inv-1',
        discountAmount: 1000,
        createdAt: new Date(),
      };
      (prisma.couponUsage.create as jest.Mock).mockResolvedValue(mockUsage);

      const result = await service.recordUsage('coup-1', 'org-1', 'inv-1', 1000);

      expect(result.id).toBe('usage-1');
    });
  });

  describe('findByCode', () => {
    it('should return coupon by code', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(mockCoupon);

      const result = await service.findByCode('SUMMER2026');

      expect(result.code).toBe('SUMMER2026');
    });

    it('should throw if not found', async () => {
      (prisma.coupon.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByCode('INVALID')).rejects.toThrow(NotFoundException);
    });
  });
});
