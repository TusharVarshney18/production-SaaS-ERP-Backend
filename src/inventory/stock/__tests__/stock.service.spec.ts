import { BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { StockService } from '../stock.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('StockService', () => {
  let service: StockService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new StockService(prisma, auditLog);
  });

  afterEach(() => jest.clearAllMocks());

  const mockStock = {
    id: 'stock-1',
    organizationId: 'org-1',
    warehouseId: 'wh-1',
    productId: 'prod-1',
    availableQty: 100,
    reservedQty: 10,
    damagedQty: 0,
    reorderLevel: 20,
    maxLevel: 500,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getStock', () => {
    it('should return stock when exists', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      const result = await service.getStock('org-1', 'wh-1', 'prod-1');
      expect(result.availableQty).toBe(100);
    });

    it('should return default stock when not exists', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await service.getStock('org-1', 'wh-1', 'prod-1');
      expect(result.availableQty).toBe(0);
    });
  });

  describe('reserve', () => {
    it('should reserve stock when sufficient', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({
        ...mockStock,
        availableQty: 90,
        reservedQty: 20,
      });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.reserve(
        'org-1',
        {
          warehouseId: 'wh-1',
          productId: 'prod-1',
          quantity: 10,
          referenceType: 'SalesOrder',
          referenceId: 'so-1',
        },
        'user-1',
        'req-1',
      );
      expect(result.availableQty).toBe(90);
      expect(result.reservedQty).toBe(20);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      await expect(
        service.reserve(
          'org-1',
          {
            warehouseId: 'wh-1',
            productId: 'prod-1',
            quantity: 200,
            referenceType: 'SalesOrder',
            referenceId: 'so-1',
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('release', () => {
    it('should release reserved stock', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({
        ...mockStock,
        availableQty: 110,
        reservedQty: 0,
      });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.release(
        'org-1',
        {
          warehouseId: 'wh-1',
          productId: 'prod-1',
          quantity: 10,
          referenceType: 'SalesOrder',
          referenceId: 'so-1',
        },
        'user-1',
        'req-1',
      );
      expect(result.availableQty).toBe(110);
      expect(result.reservedQty).toBe(0);
    });

    it('should throw BadRequestException when insufficient reserved stock', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      await expect(
        service.release(
          'org-1',
          {
            warehouseId: 'wh-1',
            productId: 'prod-1',
            quantity: 100,
            referenceType: 'SalesOrder',
            referenceId: 'so-1',
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adjust', () => {
    it('should increase stock with positive adjustment', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({
        ...mockStock,
        availableQty: 150,
      });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.adjust(
        'org-1',
        { warehouseId: 'wh-1', productId: 'prod-1', quantity: 50, reason: 'Stock take correction' },
        'user-1',
        'req-1',
      );
      expect(result.availableQty).toBe(150);
    });

    it('should decrease stock with negative adjustment', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({
        ...mockStock,
        availableQty: 80,
      });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.adjust(
        'org-1',
        { warehouseId: 'wh-1', productId: 'prod-1', quantity: -20, reason: 'Damage' },
        'user-1',
        'req-1',
      );
      expect(result.availableQty).toBe(80);
    });

    it('should throw BadRequestException when adjustment goes negative', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      await expect(
        service.adjust(
          'org-1',
          { warehouseId: 'wh-1', productId: 'prod-1', quantity: -200, reason: 'Oversight' },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('increase', () => {
    it('should increase available stock', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({
        ...mockStock,
        availableQty: 150,
      });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.increase(
        'org-1',
        'wh-1',
        'prod-1',
        50,
        'Purchase',
        'po-1',
        'user-1',
        'req-1',
      );
      expect(result.availableQty).toBe(150);
    });
  });

  describe('decrease', () => {
    it('should decrease available stock', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({
        ...mockStock,
        availableQty: 80,
      });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.decrease(
        'org-1',
        'wh-1',
        'prod-1',
        20,
        'Sale',
        'so-1',
        'user-1',
        'req-1',
      );
      expect(result.availableQty).toBe(80);
    });

    it('should throw BadRequestException when insufficient stock', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      await expect(
        service.decrease('org-1', 'wh-1', 'prod-1', 200, 'Sale', 'so-1', 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Ledger entry creation', () => {
    it('should create a ledger entry for every stock movement', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      (prisma.stock.update as jest.Mock).mockResolvedValue({ ...mockStock, availableQty: 90 });
      (prisma.stockLedger.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      await service.reserve(
        'org-1',
        {
          warehouseId: 'wh-1',
          productId: 'prod-1',
          quantity: 10,
          referenceType: 'SalesOrder',
          referenceId: 'so-1',
        },
        'user-1',
        'req-1',
      );

      expect(prisma.stockLedger.create).toHaveBeenCalledTimes(1);
      expect(prisma.stockLedger.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            warehouseId: 'wh-1',
            productId: 'prod-1',
            transactionType: 'RESERVATION',
            referenceType: 'SalesOrder',
            referenceId: 'so-1',
          }),
        }),
      );
    });
  });

  describe('Organization isolation', () => {
    it('should scope queries to organizationId', async () => {
      (prisma.stock.findFirst as jest.Mock).mockResolvedValue(mockStock);
      await service.getStock('org-1', 'wh-1', 'prod-1');
      expect(prisma.stock.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1' }),
        }),
      );
    });
  });
});
