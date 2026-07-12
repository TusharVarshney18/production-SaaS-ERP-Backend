import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { TransferService } from '../transfer.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { StockService } from '../../stock/stock.service';

describe('TransferService', () => {
  let service: TransferService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;
  let stock: DeepMockProxy<StockService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    stock = mockDeep<StockService>();
    service = new TransferService(prisma, auditLog, stock);
  });

  afterEach(() => jest.clearAllMocks());

  const mockTransfer = {
    id: 'tr-1',
    organizationId: 'org-1',
    fromWarehouseId: 'wh-1',
    toWarehouseId: 'wh-2',
    status: 'DRAFT',
    notes: null,
    createdBy: 'user-1',
    approvedBy: null,
    completedBy: null,
    cancelledBy: null,
    cancelledReason: null,
    completedAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [{ id: 'item-1', transferId: 'tr-1', productId: 'prod-1', quantity: 10 }],
  };

  const mockWarehouse = {
    id: 'wh-1',
    organizationId: 'org-1',
    code: 'WH-1',
    name: 'Warehouse 1',
    isDefault: false,
    status: 'ACTIVE',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('should create a transfer', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.inventoryTransfer.create as jest.Mock).mockResolvedValue(mockTransfer);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        {
          fromWarehouseId: 'wh-1',
          toWarehouseId: 'wh-2',
          items: [{ productId: 'prod-1', quantity: 10 }],
        },
        'user-1',
        'req-1',
      );
      expect(result.id).toBe('tr-1');
    });

    it('should throw when source and destination are same', async () => {
      await expect(
        service.create(
          'org-1',
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-1',
            items: [{ productId: 'prod-1', quantity: 10 }],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException for invalid warehouse', async () => {
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.create(
          'org-1',
          {
            fromWarehouseId: 'wh-1',
            toWarehouseId: 'wh-2',
            items: [{ productId: 'prod-1', quantity: 10 }],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return transfer', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(mockTransfer);
      const result = await service.findOne('org-1', 'tr-1');
      expect(result.id).toBe('tr-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'tr-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('should set status to IN_TRANSIT', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(mockTransfer);
      (prisma.inventoryTransfer.update as jest.Mock).mockResolvedValue({
        ...mockTransfer,
        status: 'IN_TRANSIT',
        approvedBy: 'user-1',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.approve('org-1', 'tr-1', 'user-1', 'req-1');
      expect(result.status).toBe('IN_TRANSIT');
    });

    it('should throw for non-DRAFT status', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue({
        ...mockTransfer,
        status: 'COMPLETED',
      });
      await expect(service.approve('org-1', 'tr-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('complete', () => {
    it('should complete transfer and move stock', async () => {
      const inTransitTransfer = {
        ...mockTransfer,
        status: 'IN_TRANSIT',
        items: mockTransfer.items,
      };
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(inTransitTransfer);
      (prisma.inventoryTransferItem.findMany as jest.Mock).mockResolvedValue(mockTransfer.items);
      (stock.transferStock as jest.Mock).mockResolvedValue({});
      (prisma.inventoryTransfer.update as jest.Mock).mockResolvedValue({
        ...inTransitTransfer,
        status: 'COMPLETED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.complete('org-1', 'tr-1', 'user-1', 'req-1');
      expect(result.status).toBe('COMPLETED');
      expect(stock.transferStock).toHaveBeenCalledWith(
        'org-1',
        'wh-1',
        'wh-2',
        'prod-1',
        10,
        'tr-1',
        'user-1',
      );
    });

    it('should throw for non IN_TRANSIT status', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(mockTransfer);
      await expect(service.complete('org-1', 'tr-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel DRAFT transfer', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(mockTransfer);
      (prisma.inventoryTransfer.update as jest.Mock).mockResolvedValue({
        ...mockTransfer,
        status: 'CANCELLED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.cancel('org-1', 'tr-1', 'No longer needed', 'user-1', 'req-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw for COMPLETED transfer', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue({
        ...mockTransfer,
        status: 'COMPLETED',
      });
      await expect(service.cancel('org-1', 'tr-1', null, 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.inventoryTransfer.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'tr-1')).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryTransfer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
