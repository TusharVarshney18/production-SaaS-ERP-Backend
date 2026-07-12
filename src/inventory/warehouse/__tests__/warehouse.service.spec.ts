import { NotFoundException, ConflictException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { WarehouseService } from '../warehouse.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('WarehouseService', () => {
  let service: WarehouseService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new WarehouseService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockWarehouse = {
    id: 'wh-1',
    organizationId: 'org-1',
    code: 'WH-MAIN',
    name: 'Main Warehouse',
    description: null,
    address: null,
    managerId: null,
    isDefault: true,
    status: 'ACTIVE',
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a warehouse', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.warehouse.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
      (prisma.warehouse.create as jest.Mock).mockResolvedValue(mockWarehouse);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        { code: 'WH-MAIN', name: 'Main Warehouse' },
        'user-1',
        'req-1',
      );
      expect(result.code).toBe('WH-MAIN');
    });

    it('should throw ConflictException if code exists', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      await expect(
        service.create('org-1', { code: 'WH-MAIN', name: 'Main Warehouse' }, 'user-1', 'req-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated warehouses', async () => {
      (prisma.warehouse.findMany as jest.Mock).mockResolvedValue([mockWarehouse]);
      (prisma.warehouse.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return warehouse', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      const result = await service.findOne('org-1', 'wh-1');
      expect(result.id).toBe('wh-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'wh-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update warehouse', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.warehouse.update as jest.Mock).mockResolvedValue({
        ...mockWarehouse,
        name: 'Updated',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update('org-1', 'wh-1', { name: 'Updated' }, 'user-1', 'req-1');
      expect(result.name).toBe('Updated');
    });
  });

  describe('archive', () => {
    it('should set status to INACTIVE', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.warehouse.update as jest.Mock).mockResolvedValue({
        ...mockWarehouse,
        status: 'INACTIVE',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'wh-1', 'user-1', 'req-1');
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('restore', () => {
    it('should set status to ACTIVE', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue({
        ...mockWarehouse,
        status: 'INACTIVE',
      });
      (prisma.warehouse.update as jest.Mock).mockResolvedValue(mockWarehouse);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'wh-1', 'user-1', 'req-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('delete', () => {
    it('should soft delete warehouse', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.warehouse.update as jest.Mock).mockResolvedValue(mockWarehouse);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'wh-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'wh-1')).rejects.toThrow(NotFoundException);
      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
