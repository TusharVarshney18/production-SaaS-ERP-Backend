import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { SalesInvoiceStatus, InvoicePaymentStatus, SalesOrderStatus } from '@prisma/client';
import { InvoicesService } from '../invoices.service';
import { PricingService } from '../../sales/pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;
  let pricing: PricingService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    pricing = new PricingService();
    service = new InvoicesService(prisma, auditLog, pricing);
  });

  afterEach(() => jest.clearAllMocks());

  const mockInvoice = {
    id: 'inv-1',
    organizationId: 'org-1',
    invoiceNumber: 'INV-000001',
    salesOrderId: null,
    quotationId: null,
    companyId: 'comp-1',
    contactId: 'cont-1',
    ownerId: 'user-1',
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    currency: 'USD',
    exchangeRate: 1,
    subtotal: 5000,
    discountAmount: 0,
    taxAmount: 500,
    shippingAmount: 200,
    grandTotal: 5700,
    amountPaid: 0,
    balanceDue: 5700,
    paymentStatus: InvoicePaymentStatus.UNPAID,
    status: SalesInvoiceStatus.DRAFT,
    notes: null,
    terms: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockItem = {
    id: 'item-1',
    invoiceId: 'inv-1',
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
    status: SalesOrderStatus.FULFILLED,
    notes: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fullInvoice = {
    ...mockInvoice,
    items: [mockItem],
    salesOrder: null,
    quotation: null,
    company: { id: 'comp-1', name: 'Acme Corp' },
    contact: { id: 'cont-1', fullName: 'John Doe', email: 'john@example.com' },
    owner: { id: 'user-1', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' },
    timeline: [],
  };

  describe('create', () => {
    it('should create an invoice with items and audit log using PricingService', async () => {
      (prisma.salesInvoice.count as jest.Mock).mockResolvedValue(0);
      (prisma.salesInvoice.create as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        {
          companyId: 'comp-1',
          contactId: 'cont-1',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000, taxRate: 10 }],
        },
        'user-1',
        'req-1',
      );

      expect(result.invoiceNumber).toBe('INV-000001');
      expect(prisma.salesInvoice.create).toHaveBeenCalled();
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'sales_invoice.created' }),
      );
    });
  });

  describe('createFromSalesOrder', () => {
    it('should generate invoice from fulfilled order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        items: [mockItem],
      });
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.salesInvoice.count as jest.Mock).mockResolvedValue(0);
      (prisma.salesInvoice.create as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createFromSalesOrder('org-1', 'ord-1', 'user-1', 'req-1');
      expect(result.invoiceNumber).toBe('INV-000001');
      expect(prisma.salesInvoice.create).toHaveBeenCalled();
    });

    it('should throw for non-fulfilled order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: SalesOrderStatus.DRAFT,
        items: [],
      });

      await expect(
        service.createFromSalesOrder('org-1', 'ord-1', 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if invoice already exists for order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue({
        ...mockOrder,
        items: [],
      });
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);

      await expect(
        service.createFromSalesOrder('org-1', 'ord-1', 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-existent order', async () => {
      (prisma.salesOrder.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.createFromSalesOrder('org-1', 'ord-1', 'user-1', 'req-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      (prisma.salesInvoice.findMany as jest.Mock).mockResolvedValue([fullInvoice]);
      (prisma.salesInvoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by payment status', async () => {
      (prisma.salesInvoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.salesInvoice.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { paymentStatus: InvoicePaymentStatus.UNPAID });

      expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentStatus: InvoicePaymentStatus.UNPAID }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return invoice with relations', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);
      const result = await service.findOne('org-1', 'inv-1');
      expect(result.id).toBe('inv-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'inv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'inv-1',
        { notes: 'Updated' },
        'user-1',
        'req-1',
      );
      expect(result).toBeDefined();
    });

    it('should reject update for sent invoice', async () => {
      const sentInvoice = { ...fullInvoice, status: SalesInvoiceStatus.SENT };
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(sentInvoice);

      await expect(
        service.update('org-1', 'inv-1', { notes: 'test' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('status transitions', () => {
    it('should send a draft invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue({
        ...fullInvoice,
        status: SalesInvoiceStatus.SENT,
      });
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.send('org-1', 'inv-1', 'user-1', 'req-1');
      expect(result.status).toBe(SalesInvoiceStatus.SENT);
    });

    it('should reject send from SENT status', async () => {
      const sentInvoice = { ...fullInvoice, status: SalesInvoiceStatus.SENT };
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(sentInvoice);

      await expect(service.send('org-1', 'inv-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should void an invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue({
        ...fullInvoice,
        status: SalesInvoiceStatus.VOID,
      });
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.void('org-1', 'inv-1', 'user-1', 'req-1');
      expect(result.status).toBe(SalesInvoiceStatus.VOID);
    });

    it('should reject void from already voided', async () => {
      const voidedInvoice = { ...fullInvoice, status: SalesInvoiceStatus.VOID };
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(voidedInvoice);

      await expect(service.void('org-1', 'inv-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('duplicate', () => {
    it('should create a copy of the invoice using PricingService', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoice.count as jest.Mock).mockResolvedValue(1);
      (prisma.salesInvoice.create as jest.Mock).mockResolvedValue({
        ...fullInvoice,
        id: 'inv-2',
        invoiceNumber: 'INV-000002',
      });
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.duplicate('org-1', 'inv-1', 'user-1', 'req-1');
      expect(result.invoiceNumber).toBe('INV-000002');
      expect(prisma.salesInvoice.create).toHaveBeenCalled();
    });
  });

  describe('archive / restore / delete', () => {
    it('should archive a voided invoice', async () => {
      const voidedInvoice = { ...fullInvoice, status: SalesInvoiceStatus.VOID };
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(voidedInvoice);
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue(voidedInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.archive('org-1', 'inv-1', 'user-1', 'req-1');
      expect(result.message).toContain('archived');
    });

    it('should reject archive for sent invoices', async () => {
      const sentInvoice = { ...fullInvoice, status: SalesInvoiceStatus.SENT };
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(sentInvoice);

      await expect(service.archive('org-1', 'inv-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should restore an archived invoice', async () => {
      const archivedInvoice = {
        ...mockInvoice,
        deletedAt: new Date(),
        deletedByUserId: 'user-1',
        deletedReason: 'Archived',
      };
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(archivedInvoice);
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.restore('org-1', 'inv-1', 'user-1', 'req-1');
      expect(result).toBeDefined();
    });

    it('should soft delete', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue(mockInvoice);
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.delete('org-1', 'inv-1', 'user-1', 'req-1');
      expect(result.message).toContain('deleted');
    });
  });

  describe('PricingService reuse', () => {
    it('should use PricingService to calculate totals on create', async () => {
      const pricingSpy = jest.spyOn(pricing, 'calculateSummary');

      (prisma.salesInvoice.count as jest.Mock).mockResolvedValue(0);
      (prisma.salesInvoice.create as jest.Mock).mockResolvedValue(fullInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      await service.create(
        'org-1',
        {
          companyId: 'comp-1',
          contactId: 'cont-1',
          issueDate: new Date().toISOString(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'inv-1')).rejects.toThrow(NotFoundException);
      expect(prisma.salesInvoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
