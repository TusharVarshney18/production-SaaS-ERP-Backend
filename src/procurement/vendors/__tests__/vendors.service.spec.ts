import { NotFoundException, ConflictException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { VendorsService } from '../vendors.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('VendorsService', () => {
  let service: VendorsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new VendorsService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockVendor = {
    id: 'ven-1',
    organizationId: 'org-1',
    vendorCode: 'VEND-001',
    companyName: 'Acme Supplies',
    contactName: 'John Doe',
    email: 'john@acme.com',
    phone: '1234567890',
    taxNumber: 'TAX-001',
    address: '123 Main St',
    status: 'ACTIVE',
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a vendor', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.vendor.create as jest.Mock).mockResolvedValue(mockVendor);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.create(
        'org-1',
        { vendorCode: 'VEND-001', companyName: 'Acme Supplies' },
        'user-1',
        'req-1',
      );
      expect(result.companyName).toBe('Acme Supplies');
    });

    it('should throw ConflictException if code exists', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(mockVendor);
      await expect(
        service.create('org-1', { vendorCode: 'VEND-001', companyName: 'Acme' }, 'user-1', 'req-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated vendors', async () => {
      (prisma.vendor.findMany as jest.Mock).mockResolvedValue([mockVendor]);
      (prisma.vendor.count as jest.Mock).mockResolvedValue(1);
      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return vendor', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(mockVendor);
      const result = await service.findOne('org-1', 'ven-1');
      expect(result.id).toBe('ven-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'ven-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update vendor', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.vendor.update as jest.Mock).mockResolvedValue({
        ...mockVendor,
        companyName: 'Updated Corp',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.update(
        'org-1',
        'ven-1',
        { companyName: 'Updated Corp' },
        'user-1',
        'req-1',
      );
      expect(result.companyName).toBe('Updated Corp');
    });
  });

  describe('archive', () => {
    it('should set status to INACTIVE', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.vendor.update as jest.Mock).mockResolvedValue({ ...mockVendor, status: 'INACTIVE' });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.archive('org-1', 'ven-1', 'user-1', 'req-1');
      expect(result.status).toBe('INACTIVE');
    });
  });

  describe('restore', () => {
    it('should set status to ACTIVE', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue({
        ...mockVendor,
        status: 'INACTIVE',
      });
      (prisma.vendor.update as jest.Mock).mockResolvedValue(mockVendor);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.restore('org-1', 'ven-1', 'user-1', 'req-1');
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('delete', () => {
    it('should soft delete vendor', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.vendor.update as jest.Mock).mockResolvedValue(mockVendor);
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.delete('org-1', 'ven-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'ven-1')).rejects.toThrow(NotFoundException);
      expect(prisma.vendor.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-2' }) }),
      );
    });
  });
});
