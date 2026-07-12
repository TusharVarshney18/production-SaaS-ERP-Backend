import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { GoodsReceiptService } from '../goods-receipt.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';
import { StockService } from '../../../inventory/stock/stock.service';

describe('GoodsReceiptService', () => {
  let service: GoodsReceiptService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;
  let stock: DeepMockProxy<StockService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    stock = mockDeep<StockService>();
    service = new GoodsReceiptService(prisma, auditLog, stock);
  });

  afterEach(() => jest.clearAllMocks());

  const mockPO = {
    id: 'po-1',
    organizationId: 'org-1',
    poNumber: 'PO-001',
    vendorId: 'ven-1',
    warehouseId: 'wh-1',
    expectedDate: null,
    status: 'APPROVED',
    subtotal: 10000,
    taxAmount: 1000,
    discountAmount: 0,
    grandTotal: 11000,
    notes: null,
    createdBy: 'user-1',
    approvedBy: 'user-1',
    cancelledBy: null,
    cancelledReason: null,
    approvedAt: new Date(),
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

  const mockGR = {
    id: 'gr-1',
    organizationId: 'org-1',
    grnNumber: 'GRN-001',
    purchaseOrderId: 'po-1',
    warehouseId: 'wh-1',
    status: 'RECEIVED',
    receivedDate: new Date(),
    notes: null,
    createdBy: 'user-1',
    cancelledBy: null,
    cancelledReason: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [
      {
        id: 'gri-1',
        goodsReceiptId: 'gr-1',
        purchaseOrderItemId: 'poi-1',
        productId: 'prod-1',
        quantity: 5,
        unitCost: 1000,
      },
    ],
    purchaseOrder: { id: 'po-1', poNumber: 'PO-001', status: 'APPROVED' },
    warehouse: { id: 'wh-1', name: 'Main', code: 'WH1' },
  };

  function setupTransactionMock(tx: DeepMockProxy<typeof prisma>) {
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (cb: (tx: typeof prisma) => unknown) => {
        return cb(tx);
      },
    );
  }

  describe('create', () => {
    it('should create goods receipt and increase stock', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(mockPO);
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.goodsReceipt.count as jest.Mock).mockResolvedValue(0);
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(mockGR);

      const tx = mockDeep<typeof prisma>();
      (tx.goodsReceipt.create as jest.Mock).mockResolvedValue(mockGR);
      (tx.goodsReceiptItem.update as jest.Mock).mockResolvedValue({});
      (tx.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([
        { ...mockPO.items[0], receivedQuantity: 5 },
      ]);
      (tx.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
      (tx.purchaseOrder.update as jest.Mock).mockResolvedValue({});
      (tx.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(mockGR);
      setupTransactionMock(tx);

      (stock.increase as jest.Mock).mockResolvedValue({});

      await service.create(
        'org-1',
        {
          purchaseOrderId: 'po-1',
          warehouseId: 'wh-1',
          items: [{ purchaseOrderItemId: 'poi-1', productId: 'prod-1', quantity: 5 }],
        },
        'user-1',
        'req-1',
      );

      expect(stock.increase).toHaveBeenCalledWith(
        'org-1',
        'wh-1',
        'prod-1',
        5,
        'PurchaseOrder',
        'po-1',
        'user-1',
        'req-1',
      );
    });

    it('should throw for cancelled purchase order', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'CANCELLED',
      });
      await expect(
        service.create(
          'org-1',
          {
            purchaseOrderId: 'po-1',
            warehouseId: 'wh-1',
            items: [{ purchaseOrderItemId: 'poi-1', productId: 'prod-1', quantity: 5 }],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for draft purchase order', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockPO,
        status: 'DRAFT',
      });
      await expect(
        service.create(
          'org-1',
          {
            purchaseOrderId: 'po-1',
            warehouseId: 'wh-1',
            items: [{ purchaseOrderItemId: 'poi-1', productId: 'prod-1', quantity: 5 }],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if quantity exceeds remaining', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(mockPO);
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      await expect(
        service.create(
          'org-1',
          {
            purchaseOrderId: 'po-1',
            warehouseId: 'wh-1',
            items: [{ purchaseOrderItemId: 'poi-1', productId: 'prod-1', quantity: 20 }],
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return goods receipt', async () => {
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(mockGR);
      const result = await service.findOne('org-1', 'gr-1');
      expect(result.id).toBe('gr-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'gr-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel draft goods receipt', async () => {
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue({
        ...mockGR,
        status: 'DRAFT',
      });
      (prisma.goodsReceipt.update as jest.Mock).mockResolvedValue({
        ...mockGR,
        status: 'CANCELLED',
      });
      (auditLog.create as jest.Mock).mockResolvedValue({});
      const result = await service.cancel('org-1', 'gr-1', 'Error in shipment', 'user-1', 'req-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw for already received goods receipt', async () => {
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(mockGR);
      await expect(service.cancel('org-1', 'gr-1', null, 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('Inventory integration', () => {
    it('should call stock.increase for each item received', async () => {
      (prisma.purchaseOrder.findFirst as jest.Mock).mockResolvedValue(mockPO);
      (prisma.warehouse.findFirst as jest.Mock).mockResolvedValue(mockWarehouse);
      (prisma.goodsReceipt.count as jest.Mock).mockResolvedValue(0);
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(mockGR);

      const tx = mockDeep<typeof prisma>();
      (tx.goodsReceipt.create as jest.Mock).mockResolvedValue(mockGR);
      (tx.goodsReceiptItem.update as jest.Mock).mockResolvedValue({});
      (tx.purchaseOrderItem.findMany as jest.Mock).mockResolvedValue([
        { ...mockPO.items[0], receivedQuantity: 5 },
      ]);
      (tx.purchaseOrderItem.update as jest.Mock).mockResolvedValue({});
      (tx.purchaseOrder.update as jest.Mock).mockResolvedValue({});
      (tx.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(mockGR);
      setupTransactionMock(tx);

      (stock.increase as jest.Mock).mockResolvedValue({});

      await service.create(
        'org-1',
        {
          purchaseOrderId: 'po-1',
          warehouseId: 'wh-1',
          items: [{ purchaseOrderItemId: 'poi-1', productId: 'prod-1', quantity: 5 }],
        },
        'user-1',
        'req-1',
      );

      expect(stock.increase).toHaveBeenCalledTimes(1);
      expect(stock.increase).toHaveBeenCalledWith(
        'org-1',
        'wh-1',
        'prod-1',
        5,
        'PurchaseOrder',
        'po-1',
        'user-1',
        'req-1',
      );
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.goodsReceipt.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'gr-1')).rejects.toThrow(NotFoundException);
      expect(prisma.goodsReceipt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ organizationId: 'org-2' }) }),
      );
    });
  });
});
