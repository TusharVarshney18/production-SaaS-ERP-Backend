import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  private async log(
    orgId: string,
    actorId: string,
    event: string,
    action: string,
    resource: string,
    resourceId: string,
    details: Record<string, unknown>,
    requestId: string,
  ) {
    await this.auditLog.create({
      organizationId: orgId,
      actorId,
      actorType: 'USER',
      event,
      resource,
      resourceId,
      action,
      details,
      requestId,
      severity: 'INFO',
    });
  }

  // ─── Categories ───────────────────────────

  async createCategory(orgId: string, dto: CreateCategoryDto, userId: string, requestId: string) {
    const category = await this.prisma.category.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        description: dto.description || null,
        parentCategoryId: dto.parentCategoryId || null,
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    await this.log(
      orgId,
      userId,
      'category.created',
      'CREATE',
      'category',
      category.id,
      { name: category.name },
      requestId,
    );
    return category;
  }

  async findAllCategories(orgId: string) {
    return this.prisma.category.findMany({
      where: { organizationId: orgId, isArchived: false },
      orderBy: { displayOrder: 'asc' },
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
        children: { where: { isArchived: false }, orderBy: { displayOrder: 'asc' } },
      },
    });
  }

  async findOneCategory(orgId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, organizationId: orgId },
      include: {
        products: { where: { deletedAt: null }, orderBy: { name: 'asc' } },
        children: { where: { isArchived: false }, orderBy: { displayOrder: 'asc' } },
      },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async updateCategory(
    orgId: string,
    id: string,
    dto: UpdateCategoryDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOneCategory(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.parentCategoryId !== undefined) data.parentCategoryId = dto.parentCategoryId;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.isArchived !== undefined) data.isArchived = dto.isArchived;

    const category = await this.prisma.category.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'category.updated',
      'UPDATE',
      'category',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return category;
  }

  async deleteCategory(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOneCategory(orgId, id);
    await this.prisma.category.delete({ where: { id } });
    await this.log(orgId, userId, 'category.deleted', 'DELETE', 'category', id, {}, requestId);
    return { message: 'Category deleted' };
  }

  // ─── Units ────────────────────────────────

  async createUnit(orgId: string, dto: CreateUnitDto, userId: string, requestId: string) {
    const unit = await this.prisma.unit.create({
      data: {
        organizationId: orgId,
        name: dto.name,
        shortName: dto.shortName,
        precision: dto.precision ?? 0,
      },
    });

    await this.log(
      orgId,
      userId,
      'unit.created',
      'CREATE',
      'unit',
      unit.id,
      { name: unit.name },
      requestId,
    );
    return unit;
  }

  async findAllUnits(orgId: string) {
    return this.prisma.unit.findMany({
      where: { organizationId: orgId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
  }

  async findOneUnit(orgId: string, id: string) {
    const unit = await this.prisma.unit.findFirst({ where: { id, organizationId: orgId } });
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  async updateUnit(
    orgId: string,
    id: string,
    dto: UpdateUnitDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOneUnit(orgId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.shortName !== undefined) data.shortName = dto.shortName;
    if (dto.precision !== undefined) data.precision = dto.precision;

    const unit = await this.prisma.unit.update({ where: { id }, data });
    await this.log(
      orgId,
      userId,
      'unit.updated',
      'UPDATE',
      'unit',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return unit;
  }

  async deleteUnit(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOneUnit(orgId, id);
    await this.prisma.unit.delete({ where: { id } });
    await this.log(orgId, userId, 'unit.deleted', 'DELETE', 'unit', id, {}, requestId);
    return { message: 'Unit deleted' };
  }

  // ─── Products ─────────────────────────────

  async create(orgId: string, dto: CreateProductDto, userId: string, requestId: string) {
    const product = await this.prisma.product.create({
      data: {
        organizationId: orgId,
        sku: dto.sku,
        name: dto.name,
        barcode: dto.barcode || null,
        description: dto.description || null,
        categoryId: dto.categoryId || null,
        unitId: dto.unitId || null,
        sellingPrice: dto.sellingPrice ?? 0,
        purchasePrice: dto.purchasePrice ?? 0,
        taxRate: dto.taxRate ?? 0,
        currency: dto.currency || 'USD',
        status: (dto.status as never) || 'ACTIVE',
        isService: dto.isService ?? false,
        trackInventory: dto.trackInventory ?? false,
      },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, shortName: true } },
      },
    });

    await this.log(
      orgId,
      userId,
      'product.created',
      'CREATE',
      'product',
      product.id,
      { name: product.name, sku: product.sku },
      requestId,
    );
    return product;
  }

  async findAll(orgId: string, query: ProductQueryDto) {
    const {
      search,
      categoryId,
      status,
      isService,
      trackInventory,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Record<string, unknown> = { organizationId: orgId, deletedAt: null };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (status) where.status = status;
    if (isService !== undefined) where.isService = isService;
    if (trackInventory !== undefined) where.trackInventory = trackInventory;

    const [data, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          category: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, shortName: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(orgId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId: orgId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, shortName: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(
    orgId: string,
    id: string,
    dto: UpdateProductDto,
    userId: string,
    requestId: string,
  ) {
    await this.findOne(orgId, id);

    const data: Record<string, unknown> = {};
    if (dto.sku !== undefined) data.sku = dto.sku;
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.barcode !== undefined) data.barcode = dto.barcode;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.unitId !== undefined) data.unitId = dto.unitId;
    if (dto.sellingPrice !== undefined) data.sellingPrice = dto.sellingPrice;
    if (dto.purchasePrice !== undefined) data.purchasePrice = dto.purchasePrice;
    if (dto.taxRate !== undefined) data.taxRate = dto.taxRate;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.isService !== undefined) data.isService = dto.isService;
    if (dto.trackInventory !== undefined) data.trackInventory = dto.trackInventory;

    const product = await this.prisma.product.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        unit: { select: { id: true, name: true, shortName: true } },
      },
    });

    await this.log(
      orgId,
      userId,
      'product.updated',
      'UPDATE',
      'product',
      id,
      { changes: Object.keys(data) },
      requestId,
    );
    return product;
  }

  async archive(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: 'INACTIVE' as never },
    });
    await this.log(orgId, userId, 'product.archived', 'UPDATE', 'product', id, {}, requestId);
    return product;
  }

  async restore(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { status: 'ACTIVE' as never },
    });
    await this.log(orgId, userId, 'product.restored', 'UPDATE', 'product', id, {}, requestId);
    return product;
  }

  async delete(orgId: string, id: string, userId: string, requestId: string) {
    await this.findOne(orgId, id);
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), deletedByUserId: userId, deletedReason: 'User deleted' },
    });
    await this.log(orgId, userId, 'product.deleted', 'DELETE', 'product', id, {}, requestId);
    return { message: 'Product deleted' };
  }
}
