import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { ProductsService } from '../products.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new ProductsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockProduct = {
    id: 'prod-1',
    organizationId: 'org-1',
    sku: 'SKU-001',
    barcode: null,
    name: 'Widget Pro',
    description: 'A high-quality widget',
    categoryId: null,
    unitId: null,
    sellingPrice: 2999,
    purchasePrice: 1999,
    taxRate: 10,
    currency: 'USD',
    status: 'ACTIVE',
    isService: false,
    trackInventory: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCategory = {
    id: 'cat-1',
    organizationId: 'org-1',
    name: 'Electronics',
    description: null,
    parentCategoryId: null,
    displayOrder: 0,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUnit = {
    id: 'unit-1',
    organizationId: 'org-1',
    name: 'Piece',
    shortName: 'pc',
    precision: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ─── Categories ───────────────────────────

  describe('createCategory', () => {
    it('should create a category', async () => {
      (prisma.category.create as jest.Mock).mockResolvedValue(mockCategory);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.createCategory(
        'org-1',
        { name: 'Electronics' },
        'user-1',
        'req-1',
      );
      expect(result.name).toBe('Electronics');
    });
  });

  describe('findAllCategories', () => {
    it('should list categories', async () => {
      (prisma.category.findMany as jest.Mock).mockResolvedValue([mockCategory]);
      const result = await service.findAllCategories('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOneCategory', () => {
    it('should return category', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      const result = await service.findOneCategory('org-1', 'cat-1');
      expect(result.id).toBe('cat-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOneCategory('org-2', 'cat-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category', async () => {
      (prisma.category.findFirst as jest.Mock).mockResolvedValue(mockCategory);
      (prisma.category.delete as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.deleteCategory('org-1', 'cat-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  // ─── Units ────────────────────────────────

  describe('createUnit', () => {
    it('should create a unit', async () => {
      (prisma.unit.create as jest.Mock).mockResolvedValue(mockUnit);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.createUnit(
        'org-1',
        { name: 'Piece', shortName: 'pc' },
        'user-1',
        'req-1',
      );
      expect(result.shortName).toBe('pc');
    });
  });

  describe('findAllUnits', () => {
    it('should list units', async () => {
      (prisma.unit.findMany as jest.Mock).mockResolvedValue([mockUnit]);
      const result = await service.findAllUnits('org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('deleteUnit', () => {
    it('should delete unit', async () => {
      (prisma.unit.findFirst as jest.Mock).mockResolvedValue(mockUnit);
      (prisma.unit.delete as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.deleteUnit('org-1', 'unit-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  // ─── Products ─────────────────────────────

  describe('create', () => {
    it('should create a product with audit log', async () => {
      (prisma.product.create as jest.Mock).mockResolvedValue(mockProduct);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        { sku: 'SKU-001', name: 'Widget Pro' },
        'user-1',
        'req-1',
      );

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Widget Pro',
            sku: 'SKU-001',
            organizationId: 'org-1',
          }),
        }),
      );
      expect(result.name).toBe('Widget Pro');
    });
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([mockProduct]);
      (prisma.product.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should search by name, sku, barcode', async () => {
      (prisma.product.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.product.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { search: 'Widget' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.anything() }),
              expect.objectContaining({ sku: expect.anything() }),
            ]),
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return product with relations', async () => {
      const fullProduct = { ...mockProduct, category: null, unit: null };
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(fullProduct);

      const result = await service.findOne('org-1', 'prod-1');
      expect(result.id).toBe('prod-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'prod-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update product', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        sellingPrice: 3999,
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'prod-1',
        { sellingPrice: 3999 },
        'user-1',
        'req-1',
      );
      expect(result.sellingPrice).toBe(3999);
    });
  });

  describe('archive', () => {
    it('should set product status to INACTIVE', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValue({
        ...mockProduct,
        status: 'INACTIVE',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'prod-1', 'user-1', 'req-1');
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('restore', () => {
    it('should set product status to ACTIVE', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue({
        ...mockProduct,
        status: 'INACTIVE',
      });
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'prod-1', 'user-1', 'req-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('delete', () => {
    it('should soft delete product', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(mockProduct);
      (prisma.product.update as jest.Mock).mockResolvedValue(mockProduct);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'prod-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.product.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'prod-1')).rejects.toThrow(NotFoundException);
      expect(prisma.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
