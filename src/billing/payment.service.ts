import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto) {
    const netAmount = dto.amount - 0;
    const payment = await this.prisma.payment.create({
      data: {
        organizationId: dto.organizationId,
        subscriptionId: dto.subscriptionId ?? null,
        invoiceId: dto.invoiceId ?? null,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        provider: dto.provider,
        providerPaymentId: dto.providerPaymentId ?? null,
        providerOrderId: dto.providerOrderId ?? null,
        status: dto.status ?? 'PENDING',
        netAmount,
        taxAmount: 0,
        feeAmount: 0,
        metadata: (dto.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    this.logger.log(`Payment created: ${payment.id} (${payment.amount} ${payment.currency})`);
    return payment;
  }

  async findById(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByProviderPaymentId(providerPaymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { providerPaymentId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findAll(query: PaymentQueryDto) {
    const {
      organizationId,
      subscriptionId,
      status,
      provider,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.PaymentWhereInput = {};

    if (organizationId) where.organizationId = organizationId;
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (status) where.status = status;
    if (provider) where.provider = provider;

    const orderBy: Prisma.PaymentOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { invoice: true },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async markSucceeded(id: string, providerPaymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'SUCCEEDED',
        providerPaymentId,
        paidAt: new Date(),
      },
    });

    this.logger.log(`Payment marked succeeded: ${id}`);
    return updated;
  }

  async markFailed(id: string, failureReason: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason,
      },
    });

    this.logger.log(`Payment marked failed: ${id} - ${failureReason}`);
    return updated;
  }

  async refund(id: string, amount?: number, reason?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');

    if (payment.status !== 'SUCCEEDED') {
      throw new Error('Only succeeded payments can be refunded');
    }

    const refundAmount = amount ?? payment.amount;
    const newRefundedAmount = payment.refundedAmount + refundAmount;
    const newStatus = newRefundedAmount >= payment.amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    const updated = await this.prisma.payment.update({
      where: { id },
      data: {
        status: newStatus,
        refundedAmount: newRefundedAmount,
      },
    });

    this.logger.log(
      `Payment refunded: ${id} (${refundAmount} ${payment.currency})${reason ? ` - ${reason}` : ''}`,
    );
    return updated;
  }

  async findByOrganization(organizationId: string, query: PaymentQueryDto) {
    return this.findAll({ ...query, organizationId });
  }
}
