import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SalesOrderStatus, QuotationStatus } from '@prisma/client';
import { SalesOrdersService } from '../sales-orders.service';
import { PricingService } from '../../pricing.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

describe('SalesOrdersService', () => {
  let service: SalesOrdersService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;
  let pricing: PricingService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    pricing = new PricingService();
    service = new SalesOrdersService(prisma, auditLog, pricing);
  });

  afterEach(() => jest.clearAllMocks());

  const mockOrder = {
    id: 'ord-1',
    organizationId: 'org-1',
    orderNumber: 'ORD-000001',
    quotationId: null,
    companyId: 'comp-1',
    contactId: 'cont-1',
    dealId: null,
    ownerId: 'user-1',
    orderDate: new Date(),
    expectedDeliveryDate: null,
    actualDeliveryDate: null,
    currency: 'USD',
    exchangeRate: 1,
    subtotal: 5000,
    discountAmount: 0,
    taxAmount: 500,
    shippingAmount: 200,
    grandTotal: 5700,
    status: SalesOrderStatus.DRAFT,
    notes: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockItem = {
    id: 'item-1',
    salesOrderId: 'ord-1',
    productId: 'prod-1',
    description: null,
    quantity: 5,
    unitPrice: 1000,
    discount: 0,
    taxRate: 10,
    lineTotal: 5000,
    displayOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockQuotation = {
    id: 'qtn-1',
    organizationId: 'org-1',
    quotationNumber: 'QTN-000001',
    companyId: 'comp-1',
    contactId: 'cont-1',
    dealId: null,
    ownerId: 'user-1',
    issueDate: new Date(),
    expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    currency: 'USD',
    exchangeRate: 1,
    subtotal: 5000,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    taxAmount: 500,
    shippingAmount: 200,
    grandTotal: 5700,
    status: QuotationStatus.ACCEPTED,
    notes: null,
    termsAndConditions: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fullOrder = {
    ...mockOrder,
    items: [mockItem],
    quotation: null,
    company: { id: 'comp-1', name: 'Acme Corp' },
    contact: { id: 'cont-1', fullName: 'John Doe', email: 'john@example.com' },
    deal: null,
    owner: { id: 'user-1', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' },
    timeline: [],
  };

  describe('create', () => {
    it('should create a sales order with items and audit log using PricingService', async () => {
      (prisma.salesOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.salesOrder.create as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        {
          companyId: 'comp-1',
          contactId: 'cont-1',
          orderDate: new Date().toISOString(),
          items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000, taxRate: 10 }],
        },
        'user-1',
        'req-1',
      );

      expect(result.orderNumber).toBe('ORD-000001');
      expect(prisma.salesOrder.create).toHaveBeenCalled();
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'sales_order.created' }),
      );
    });
  });

  describe('convertFromQuotation', () => {
    it('should convert an accepted quotation to a sales order', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue({
        ...mockQuotation,
        items: [mockItem],
      });
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.salesOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.salesOrder.create as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.convertFromQuotation('org-1', 'qtn-1', 'user-1', 'req-1');
      expect(result.orderNumber).toBe('ORD-000001');
      expect(prisma.salesOrder.create).toHaveBeenCalled();
    });

    it('should throw for non-accepted quotation', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue({
        ...mockQuotation,
        status: QuotationStatus.DRAFT,
        items: [],
      });

      await expect(
        service.convertFromQuotation('org-1', 'qtn-1', 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if quotation already converted', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue({
        ...mockQuotation,
        items: [],
      });
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);

      await expect(
        service.convertFromQuotation('org-1', 'qtn-1', 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-existent quotation', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.convertFromQuotation('org-1', 'qtn-1', 'user-1', 'req-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      (prisma.salesOrder.findMany as jest.Mock).mockResolvedValue([fullOrder]);
      (prisma.salesOrder.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return order with relations', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      const result = await service.findOne('org-1', 'ord-1');
      expect(result.id).toBe('ord-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'ord-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'ord-1',
        { notes: 'Updated' },
        'user-1',
        'req-1',
      );
      expect(result).toBeDefined();
    });

    it('should reject update for confirmed order', async () => {
      const confirmedOrder = { ...fullOrder, status: SalesOrderStatus.CONFIRMED };
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(confirmedOrder);

      await expect(
        service.update('org-1', 'ord-1', { notes: 'test' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('status transitions', () => {
    it('should confirm a draft order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue({
        ...fullOrder,
        status: SalesOrderStatus.CONFIRMED,
      });
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.confirm('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result.status).toBe(SalesOrderStatus.CONFIRMED);
    });

    it('should reject confirm from CONFIRMED status', async () => {
      const confirmedOrder = { ...fullOrder, status: SalesOrderStatus.CONFIRMED };
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(confirmedOrder);

      await expect(service.confirm('org-1', 'ord-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should cancel a draft order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue({
        ...fullOrder,
        status: SalesOrderStatus.CANCELLED,
      });
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.cancel('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result.status).toBe(SalesOrderStatus.CANCELLED);
    });

    it('should change status via changeStatus', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue({
        ...fullOrder,
        status: SalesOrderStatus.CONFIRMED,
      });
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.changeStatus(
        'org-1',
        'ord-1',
        SalesOrderStatus.CONFIRMED,
        'user-1',
        'req-1',
      );
      expect(result.status).toBe(SalesOrderStatus.CONFIRMED);
    });
  });

  describe('duplicate', () => {
    it('should create a copy of the order using PricingService', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrder.count as jest.Mock).mockResolvedValue(1);
      (prisma.salesOrder.create as jest.Mock).mockResolvedValue({
        ...fullOrder,
        id: 'ord-2',
        orderNumber: 'ORD-000002',
      });
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.duplicate('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result.orderNumber).toBe('ORD-000002');
      expect(prisma.salesOrder.create).toHaveBeenCalled();
    });
  });

  describe('archive / restore / delete', () => {
    it('should archive a fulfilled order', async () => {
      const fulfilledOrder = { ...fullOrder, status: SalesOrderStatus.FULFILLED };
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fulfilledOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue(fulfilledOrder);
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result.message).toContain('archived');
    });

    it('should reject archive for active orders', async () => {
      const confirmedOrder = { ...fullOrder, status: SalesOrderStatus.CONFIRMED };
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(confirmedOrder);

      await expect(service.archive('org-1', 'ord-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should restore an archived order', async () => {
      const archivedOrder = {
        ...mockOrder,
        deletedAt: new Date(),
        deletedByUserId: 'user-1',
        deletedReason: 'Archived',
      };
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(archivedOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result).toBeDefined();
    });

    it('should soft delete', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrder.update as jest.Mock).mockResolvedValue(mockOrder);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('PricingService reuse', () => {
    it('should use PricingService to calculate totals on create', async () => {
      const pricingSpy = jest.spyOn(pricing, 'calculateSummary');

      (prisma.salesOrder.count as jest.Mock).mockResolvedValue(0);
      (prisma.salesOrder.create as jest.Mock).mockResolvedValue(fullOrder);
      (prisma.salesOrderTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      await service.create(
        'org-1',
        {
          companyId: 'comp-1',
          contactId: 'cont-1',
          orderDate: new Date().toISOString(),
          items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000, taxRate: 10 }],
        },
        'user-1',
        'req-1',
      );

      expect(pricingSpy).toHaveBeenCalled();
      pricingSpy.mockRestore();
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'ord-1')).rejects.toThrow(NotFoundException);
      expect(prisma.salesOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
