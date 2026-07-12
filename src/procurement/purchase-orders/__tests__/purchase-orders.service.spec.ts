import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PurchaseOrdersService } from '../purchase-orders.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new PurchaseOrdersService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockPO = {
    id: 'po-1',
    organizationId: 'org-1',
    poNumber: 'PO-001',
    vendorId: 'ven-1',
    warehouseId: 'wh-1',
    expectedDate: null,
    status: 'DRAFT',
    subtotal: 10000,
    taxAmount: 1000,
    discountAmount: 0,
    grandTotal: 11000,
    notes: null,
    createdBy: 'user-1',
    approvedBy: null,
    cancelledBy: null,
    cancelledReason: null,
    approvedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'poi-1',
        purchaseOrderId: 'po-1',
        productId: 'prod-1',
        quantity: 10,
        receivedQuantity: 0,
        unitCost: 1000,
        taxRate: 10,
        lineTotal: 10000,
      },
    ],
  };

  const mockVendor = {
    id: 'ven-1',
    organizationId: 'org-1',
    vendorCode: 'V001',
    companyName: 'Acme',
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const mockWarehouse = {
    id: 'wh-1',
    organizationId: 'org-1',
    code: 'WH1',
    name: 'Main',
    isDefault: false,
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a purchase order', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(mockVendor);
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.purchaseOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue(mockPO);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        {
          vendorId: 'ven-1',
          warehouseId: 'wh-1',
          items: [{ productId: 'prod-1', quantity: 10, unitCost: 1000, taxRate: 10 }],
        },
        'user-1',
        'req-1',
      );
      expect(result.id).toBe('po-1');
    });

    it('should throw NotFoundException for invalid vendor', async () => {
      (prisma.vendor.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.create(
          'org-1',
          {
            vendorId: 'ven-1',
            warehouseId: 'wh-1',
            items: [{ productId: 'prod-1', quantity: 10, unitCost: 1000 }],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return purchase order', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(mockPO);
      const result = await service.findOne('org-1', 'po-1');
      expect(result.id).toBe('po-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'po-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should set status to APPROVED', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(mockPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'APPROVED',
        approvedBy: 'user-1',
        approvedAt: new Date(),
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.approve('org-1', 'po-1', 'user-1', 'req-1');
      expect(result.status).toBe('APPROVED');
    });

    it('should throw for RECEIVED status', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'RECEIVED',
      });
      await expect(service.approve('org-1', 'po-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel DRAFT purchase order', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(mockPO);
      (prisma.purchaseOrder.update as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'CANCELLED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.cancel('org-1', 'po-1', 'No longer needed', 'user-1', 'req-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw for RECEIVED status', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'RECEIVED',
      });
      await expect(service.cancel('org-1', 'po-1', null, 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('duplicate', () => {
    it('should create a new PO from source', async () => {
      const fullPO = { ...mockPO, items: mockPO.items };
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(fullPO);
      (prisma.purchaseOrder.count as jest.Mock).mockResolvedValue(1);
      (prisma.purchaseOrder.create as jest.Mock).mockResolvedValue({
        ...mockPO,
        id: 'po-2',
        poNumber: 'PO-002',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.duplicate('org-1', 'po-1', 'user-1', 'req-1');
      expect(result.id).toBe('po-2');
    });
  });

  describe('update', () => {
    it('should throw for non-DRAFT status', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'APPROVED',
      });
      await expect(
        service.update('org-1', 'po-1', { notes: 'Updated' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'po-1')).rejects.toThrow(NotFoundException);
      expect(prisma.purchaseOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-2' }) }),
      );
    });
  });
});
