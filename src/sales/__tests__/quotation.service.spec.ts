import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { QuotationStatus } from '@prisma/client';
import { QuotationService } from '../quotation.service';
import { PricingService } from '../pricing.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('QuotationService', () => {
  let service: QuotationService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;
  let pricing: PricingService;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    pricing = new PricingService();
    service = new QuotationService(prisma, auditLog, pricing);
  });

  afterEach(() => jest.clearAllMocks());

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
    status: QuotationStatus.DRAFT,
    notes: null,
    termsAndConditions: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockItem = {
    id: 'item-1',
    quotationId: 'qtn-1',
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

  const fullQuotation = {
    ...mockQuotation,
    items: [mockItem],
    company: { id: 'comp-1', name: 'Acme Corp' },
    contact: { id: 'cont-1', fullName: 'John Doe', email: 'john@example.com' },
    deal: null,
    owner: { id: 'user-1', email: 'admin@example.com', firstName: 'Admin', lastName: 'User' },
    timeline: [],
  };

  describe('create', () => {
    it('should create a quotation with items and audit log', async () => {
      (prisma.quotation.count as jest.Mock).mockResolvedValue(0);
      (prisma.quotation.create as jest.Mock).mockResolvedValue(fullQuotation);
      (prisma.quotationTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.create(
        'org-1',
        {
          companyId: 'comp-1',
          contactId: 'cont-1',
          issueDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          items: [{ productId: 'prod-1', quantity: 5, unitPrice: 1000, taxRate: 10 }],
        },
        'user-1',
        'req-1',
      );

      expect(result.quotationNumber).toBe('QTN-000001');
      expect(prisma.quotation.create).toHaveBeenCalled();
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'quotation.created' }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated quotations', async () => {
      (prisma.quotation.findMany as jest.Mock).mockResolvedValue([fullQuotation]);
      (prisma.quotation.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by status', async () => {
      (prisma.quotation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.quotation.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { status: QuotationStatus.DRAFT });

      expect(prisma.quotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: QuotationStatus.DRAFT }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return quotation with relations', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(fullQuotation);
      const result = await service.findOne('org-1', 'qtn-1');
      expect(result.id).toBe('qtn-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'qtn-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update draft quotation', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(fullQuotation);
      (prisma.quotation.update as jest.Mock).mockResolvedValue(fullQuotation);
      (prisma.quotationTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.update(
        'org-1',
        'qtn-1',
        { notes: 'Updated notes' },
        'user-1',
        'req-1',
      );
      expect(result).toBeDefined();
    });

    it('should reject update for non-draft quotation', async () => {
      const sentQuotation = { ...fullQuotation, status: QuotationStatus.SENT };
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(sentQuotation);

      await expect(
        service.update('org-1', 'qtn-1', { notes: 'test' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('status transitions', () => {
    it('should send a draft quotation', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(fullQuotation);
      (prisma.quotation.update as jest.Mock).mockResolvedValue({
        ...fullQuotation,
        status: QuotationStatus.SENT,
      });
      (prisma.quotationTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.send('org-1', 'qtn-1', 'user-1', 'req-1');
      expect(result.status).toBe(QuotationStatus.SENT);
    });

    it('should reject invalid transition from DRAFT to ACCEPTED', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(fullQuotation);

      await expect(service.accept('org-1', 'qtn-1', 'user-1', 'req-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow SENT to ACCEPTED', async () => {
      const sentQuotation = { ...fullQuotation, status: QuotationStatus.SENT };
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(sentQuotation);
      (prisma.quotation.update as jest.Mock).mockResolvedValue({
        ...sentQuotation,
        status: QuotationStatus.ACCEPTED,
      });
      (prisma.quotationTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.accept('org-1', 'qtn-1', 'user-1', 'req-1');
      expect(result.status).toBe(QuotationStatus.ACCEPTED);
    });
  });

  describe('duplicate', () => {
    it('should create a copy of the quotation', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(fullQuotation);
      (prisma.quotation.count as jest.Mock).mockResolvedValue(1);
      (prisma.quotation.create as jest.Mock).mockResolvedValue({
        ...fullQuotation,
        id: 'qtn-2',
        quotationNumber: 'QTN-000002',
      });
      (prisma.quotationTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.duplicate('org-1', 'qtn-1', 'user-1', 'req-1');
      expect(result.quotationNumber).toBe('QTN-000002');
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.quotation.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'qtn-1')).rejects.toThrow(NotFoundException);
      expect(prisma.quotation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
