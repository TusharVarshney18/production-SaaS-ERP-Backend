import { NotFoundException } from '@nestjs/common';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PaymentService } from '../payment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: DeepMockProxy<PrismaService>;

  const mockPayment = {
    id: 'pay-1',
    organizationId: 'org-1',
    subscriptionId: null,
    invoiceId: null,
    amount: 2900,
    currency: 'USD',
    status: 'PENDING' as const,
    provider: 'razorpay',
    providerPaymentId: null,
    providerOrderId: null,
    refundedAmount: 0,
    taxAmount: 0,
    feeAmount: 0,
    netAmount: 2900,
    metadata: null,
    paidAt: null,
    failedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    service = new PaymentService(prisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto: CreatePaymentDto = {
      organizationId: 'org-1',
      amount: 2900,
      provider: 'razorpay',
    };

    it('should create a payment record', async () => {
      (prisma.payment.create as jest.Mock).mockResolvedValue(mockPayment);

      const result = await service.create(dto);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          subscriptionId: null,
          invoiceId: null,
          amount: 2900,
          currency: 'USD',
          provider: 'razorpay',
          providerPaymentId: null,
          providerOrderId: null,
          status: 'PENDING',
          netAmount: 2900,
          taxAmount: 0,
          feeAmount: 0,
          metadata: undefined,
        },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should accept optional fields', async () => {
      const fullDto: CreatePaymentDto = {
        organizationId: 'org-1',
        subscriptionId: 'sub-1',
        invoiceId: 'inv-1',
        amount: 5000,
        currency: 'INR',
        provider: 'stripe',
        providerPaymentId: 'pi_abc',
        providerOrderId: 'or_abc',
        status: 'SUCCEEDED',
        metadata: { source: 'webhook' },
      };
      (prisma.payment.create as jest.Mock).mockResolvedValue({ ...mockPayment, ...fullDto });

      await service.create(fullDto);

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'org-1',
          subscriptionId: 'sub-1',
          invoiceId: 'inv-1',
          amount: 5000,
          currency: 'INR',
          provider: 'stripe',
          providerPaymentId: 'pi_abc',
          providerOrderId: 'or_abc',
          status: 'SUCCEEDED',
          netAmount: 5000,
          taxAmount: 0,
          feeAmount: 0,
          metadata: { source: 'webhook' },
        },
      });
    });
  });

  describe('findById', () => {
    it('should return payment with invoice', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayment,
        invoice: null,
      });

      const result = await service.findById('pay-1');

      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        include: { invoice: true },
      });
      expect(result.id).toBe('pay-1');
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByProviderPaymentId', () => {
    it('should return payment by provider payment ID', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayment,
        providerPaymentId: 'pi_abc',
        invoice: null,
      });

      const result = await service.findByProviderPaymentId('pi_abc');

      expect(result.providerPaymentId).toBe('pi_abc');
    });

    it('should throw NotFoundException if not found', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByProviderPaymentId('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([mockPayment]);
      (prisma.payment.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should apply filters', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.payment.count as jest.Mock).mockResolvedValue(0);

      await service.findAll({
        organizationId: 'org-1',
        status: 'SUCCEEDED',
        provider: 'stripe',
      });

      const where = (prisma.payment.findMany as jest.Mock).mock.calls[0][0].where;
      expect(where.organizationId).toBe('org-1');
      expect(where.status).toBe('SUCCEEDED');
      expect(where.provider).toBe('stripe');
    });
  });

  describe('markSucceeded', () => {
    it('should mark payment as succeeded', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'SUCCEEDED',
        providerPaymentId: 'pi_abc',
        paidAt: new Date(),
      });

      const result = await service.markSucceeded('pay-1', 'pi_abc');

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId: 'pi_abc',
          paidAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('SUCCEEDED');
    });

    it('should throw if not found', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.markSucceeded('pay-1', 'pi_abc')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markFailed', () => {
    it('should mark payment as failed', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: 'Insufficient funds',
      });

      const result = await service.markFailed('pay-1', 'Insufficient funds');

      expect(result.status).toBe('FAILED');
      expect(result.failureReason).toBe('Insufficient funds');
    });
  });

  describe('refund', () => {
    const succeededPayment = { ...mockPayment, status: 'SUCCEEDED' as const };

    it('should fully refund a payment', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(succeededPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...succeededPayment,
        status: 'REFUNDED',
        refundedAmount: 2900,
      });

      const result = await service.refund('pay-1');

      expect(result.status).toBe('REFUNDED');
      expect(result.refundedAmount).toBe(2900);
    });

    it('should partially refund a payment', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(succeededPayment);
      (prisma.payment.update as jest.Mock).mockResolvedValue({
        ...succeededPayment,
        status: 'PARTIALLY_REFUNDED',
        refundedAmount: 1000,
      });

      const result = await service.refund('pay-1', 1000);

      expect(result.status).toBe('PARTIALLY_REFUNDED');
      expect(result.refundedAmount).toBe(1000);
    });

    it('should throw error for non-succeeded payment', async () => {
      (prisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      await expect(service.refund('pay-1')).rejects.toThrow(
        'Only succeeded payments can be refunded',
      );
    });
  });

  describe('findByOrganization', () => {
    it('should scope query to organization', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([mockPayment]);
      (prisma.payment.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findByOrganization('org-1', {});

      expect(result.data).toHaveLength(1);
    });
  });
});
