import { NotFoundException, BadRequestException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  SalesPaymentStatus,
  InvoicePaymentStatus,
  SalesInvoiceStatus,
  PaymentGatewayType,
} from '@prisma/client';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: DeepMockProxy<PrismaService>;
  let auditLog: DeepMockProxy<AuditLogService>;

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    auditLog = mockDeep<AuditLogService>();
    service = new PaymentsService(prisma, auditLog);
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
    status: SalesInvoiceStatus.SENT,
    notes: null,
    terms: null,
    deletedAt: null,
    deletedByUserId: null,
    deletedReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPayment = {
    id: 'pay-1',
    organizationId: 'org-1',
    invoiceId: 'inv-1',
    gateway: 'MANUAL',
    transactionId: 'TXN-001',
    amount: 5700,
    currency: 'USD',
    paymentMethod: 'bank_transfer',
    status: SalesPaymentStatus.CAPTURED,
    paidAt: new Date(),
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const fullPayment = {
    ...mockPayment,
    invoice: { id: 'inv-1', invoiceNumber: 'INV-000001' },
    allocations: [],
  };

  const mockAllocation = {
    id: 'alloc-1',
    paymentId: 'pay-1',
    invoiceId: 'inv-1',
    allocatedAmount: 5700,
    createdAt: new Date(),
  };

  describe('createManual', () => {
    it('should create manual payment and update invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.salesPayment.create as jest.Mock).mockResolvedValue(fullPayment);
      (prisma.paymentAllocation.create as jest.Mock).mockResolvedValue(mockAllocation);
      (prisma.salesInvoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        payments: [mockPayment],
      });
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        amountPaid: 5700,
        balanceDue: 0,
        paymentStatus: InvoicePaymentStatus.PAID,
        status: SalesInvoiceStatus.PAID,
      });
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createManual(
        'org-1',
        {
          invoiceId: 'inv-1',
          amount: 5700,
          transactionId: 'TXN-001',
          paymentMethod: 'bank_transfer',
          currency: 'USD',
        },
        'user-1',
        'req-1',
      );

      expect(result.payment.gateway).toBe('MANUAL');
      expect(result.invoiceStatus.paymentStatus).toBe(InvoicePaymentStatus.PAID);
      expect(prisma.salesPayment.create).toHaveBeenCalled();
      expect(prisma.paymentAllocation.create).toHaveBeenCalled();
      expect(auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'sales_payment.created_manual' }),
      );
    });

    it('should reject payment for voided invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        status: SalesInvoiceStatus.VOID,
      });

      await expect(
        service.createManual(
          'org-1',
          {
            invoiceId: 'inv-1',
            amount: 1000,
            transactionId: 'TXN-001',
            paymentMethod: 'bank_transfer',
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overpayment', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);

      await expect(
        service.createManual(
          'org-1',
          {
            invoiceId: 'inv-1',
            amount: 99999,
            transactionId: 'TXN-001',
            paymentMethod: 'bank_transfer',
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for non-existent invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createManual(
          'org-1',
          {
            invoiceId: 'inv-99',
            amount: 1000,
            transactionId: 'TXN-001',
            paymentMethod: 'bank_transfer',
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('captureGateway', () => {
    it('should capture gateway payment and update invoice', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.salesPayment.create as jest.Mock).mockResolvedValue({
        ...fullPayment,
        gateway: 'STRIPE',
        transactionId: 'pi_123',
      });
      (prisma.paymentAllocation.create as jest.Mock).mockResolvedValue(mockAllocation);
      (prisma.salesInvoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        payments: [mockPayment],
      });
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        amountPaid: 5700,
        balanceDue: 0,
        paymentStatus: InvoicePaymentStatus.PAID,
        status: SalesInvoiceStatus.PAID,
      });
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.captureGateway(
        'org-1',
        {
          invoiceId: 'inv-1',
          gateway: PaymentGatewayType.STRIPE,
          transactionId: 'pi_123',
          amount: 5700,
        },
        'user-1',
        'req-1',
      );

      expect(result.payment.gateway).toBe('STRIPE');
      expect(result.invoiceStatus.paymentStatus).toBe(InvoicePaymentStatus.PAID);
    });

    it('should reject duplicate transaction ID', async () => {
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(fullPayment);

      await expect(
        service.captureGateway(
          'org-1',
          {
            invoiceId: 'inv-1',
            gateway: PaymentGatewayType.STRIPE,
            transactionId: 'pi_123',
            amount: 5700,
          },
          'user-1',
          'req-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('allocate', () => {
    it('should allocate payment to invoice', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(fullPayment);
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.paymentAllocation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { allocatedAmount: 0 },
      });
      (prisma.paymentAllocation.create as jest.Mock).mockResolvedValue(mockAllocation);
      (prisma.salesInvoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        payments: [mockPayment],
      });
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.allocate('org-1', 'pay-1', 'inv-1', 5700, 'user-1', 'req-1');
      expect(result.allocatedAmount).toBe(5700);
    });

    it('should reject allocation exceeding remaining balance', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(fullPayment);
      (prisma.salesInvoice.findFirst as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.paymentAllocation.aggregate as jest.Mock).mockResolvedValue({
        _sum: { allocatedAmount: 5000 },
      });

      await expect(
        service.allocate('org-1', 'pay-1', 'inv-1', 5000, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('refund', () => {
    it('should refund a captured payment and update invoice', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(fullPayment);
      (prisma.salesPayment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: SalesPaymentStatus.REFUNDED,
      });
      (prisma.paymentAllocation.findFirst as jest.Mock).mockResolvedValue(mockAllocation);
      (prisma.paymentAllocation.update as jest.Mock).mockResolvedValue(mockAllocation);
      (prisma.salesInvoice.findUnique as jest.Mock).mockResolvedValue({
        ...mockInvoice,
        payments: [],
      });
      (prisma.salesInvoice.update as jest.Mock).mockResolvedValue(mockInvoice);
      (prisma.salesInvoiceTimeline.create as jest.Mock).mockResolvedValue({});
      (auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.refund(
        'org-1',
        { paymentId: 'pay-1', reason: 'Customer request' },
        'user-1',
        'req-1',
      );
      expect(result.status).toBe(SalesPaymentStatus.REFUNDED);
    });

    it('should reject refund of non-captured payment', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue({
        ...fullPayment,
        status: SalesPaymentStatus.PENDING,
      });

      await expect(
        service.refund('org-1', { paymentId: 'pay-1' }, 'user-1', 'req-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      (prisma.salesPayment.findMany as jest.Mock).mockResolvedValue([fullPayment]);
      (prisma.salesPayment.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll('org-1', {});
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter by gateway', async () => {
      (prisma.salesPayment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.salesPayment.count as jest.Mock).mockResolvedValue(0);

      await service.findAll('org-1', { gateway: PaymentGatewayType.MANUAL });

      expect(prisma.salesPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ gateway: PaymentGatewayType.MANUAL }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return payment with relations', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(fullPayment);
      const result = await service.findOne('org-1', 'pay-1');
      expect(result.id).toBe('pay-1');
    });

    it('should throw NotFoundException for wrong org', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'pay-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByInvoice', () => {
    it('should return payments for an invoice', async () => {
      (prisma.salesPayment.findMany as jest.Mock).mockResolvedValue([fullPayment]);
      const result = await service.findByInvoice('org-1', 'inv-1');
      expect(result).toHaveLength(1);
      expect(prisma.salesPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ invoiceId: 'inv-1' }),
        }),
      );
    });
  });

  describe('Organization isolation', () => {
    it('should scope findOne queries to organizationId', async () => {
      (prisma.salesPayment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne('org-2', 'pay-1')).rejects.toThrow(NotFoundException);
      expect(prisma.salesPayment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-2' }),
        }),
      );
    });
  });
});
