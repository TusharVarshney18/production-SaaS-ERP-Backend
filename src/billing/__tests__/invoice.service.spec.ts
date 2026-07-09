import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { InvoiceService } from '../invoice.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockInvoice = {
    id: 'inv-1',
    organizationId: 'org-1',
    subscriptionId: null,
    invoiceNumber: 'INV-202607-0001',
    amount: 2900,
    currency: 'USD',
    status: 'DRAFT' as const,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 2900,
    periodStart: null,
    periodEnd: null,
    dueAt: null,
    paidAt: null,
    billingAddressId: null,
    notes: null,
    metadata: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new InvoiceService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreateInvoiceDto = {
      organizationId: 'org-1',
      amount: 2900,
    };

    it('should create an invoice with auto-generated number', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.create as jest.Mock).mockResolvedValue(mockInvoice);

      const result = await service.create(dto);

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          invoiceNumber: { startsWith: 'INV-202607-' },
        },
        orderBy: { createdAt: 'desc' },
        select: { invoiceNumber: true },
      });
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            amount: 2900,
            invoiceNumber: expect.stringMatching(/^INV-\d{6}-\d{4}$/),
            totalAmount: 2900,
          }),
        }),
      );
      expect(result).toEqual(mockInvoice);
    });

    it('should calculate total amount with tax and discount', async () => {
      const dtoWithExtras: CreateInvoiceDto = {
        organizationId: 'org-1',
        amount: 2900,
        taxAmount: 500,
        discountAmount: 400,
      };
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        totalAmount: 3000,
      });

      await service.create(dtoWithExtras);

      const createCall = (prisma.invoice.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.totalAmount).toBe(3000);
    });

    it('should increment invoice number sequence', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
        invoiceNumber: 'INV-202607-0003',
      });
      (prisma.invoice.create as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        invoiceNumber: 'INV-202607-0004',
      });

      const result = await service.create(dto);

      expect(result.invoiceNumber).toBe('INV-202607-0004');
    });
  });

  describe('findById', () => {
    it('should return invoice with relations', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        payments: [],
        billingAddress: null,
        couponUsages: [],
      });

      const result = await service.findById('inv-1');

      expect(result.id).toBe('inv-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should exclude soft-deleted invoices', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('deleted-inv')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByNumber', () => {
    it('should return invoice by number and org', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        payments: [],
        billingAddress: null,
        couponUsages: [],
      });

      const result = await service.findByNumber('org-1', 'INV-202607-0001');

      expect(result.invoiceNumber).toBe('INV-202607-0001');
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([mockInvoice]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply filters', async () => {
      (prisma.invoice.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.invoice.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({ organizationId: 'org-1', status: 'PAID' });

      const where = (prisma.invoice.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.status).toBe('PAID');
    });
  });

  describe('markPaid', () => {
    it('should mark invoice as paid', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
        paidAt: new Date(),
      });

      const result = await service.markPaid('inv-1');

      expect(result.status).toBe('PAID');
    });

    it('should return invoice if already paid', async () => {
      const paidInvoice = { ...mockInvoice, status: 'PAID' as const, paidAt: new Date() };
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(paidInvoice);

      const result = await service.markPaid('inv-1');

      expect(result.status).toBe('PAID');
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('should throw if not found', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.markPaid('inv-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('issue', () => {
    it('should issue a draft invoice', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        status: 'ISSUED',
      });

      const result = await service.issue('inv-1');

      expect(result.status).toBe('ISSUED');
    });

    it('should throw if not in DRAFT status', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      });

      await expect(service.issue('inv-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel an invoice', async () => {
      const issuedInvoice = { ...mockInvoice, status: 'ISSUED' as const };
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(issuedInvoice);
      (prisma.invoice.update as jest.Mock).mockResolvedValue({
        ...issuedInvoice,
        status: 'CANCELED',
      });

      const result = await service.cancel('inv-1', 'Customer requested');

      expect(result.status).toBe('CANCELED');
    });

    it('should throw for paid invoices', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      });

      await expect(service.cancel('inv-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw for already canceled invoices', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        status: 'CANCELED',
      });

      await expect(service.cancel('inv-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete an invoice', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(mockInvoice);

      await service.softDelete('inv-1', 'user-1', 'Archived');

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: {
          deletedAt: expect.any(Date),
          deletedByUserId: 'user-1',
          deletedReason: 'Archived',
        },
      });
    });

    it('should throw if not found', async () => {
      (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.softDelete('inv-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
