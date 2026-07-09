import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { PaymentProvider } from '../interfaces/payment-provider.interface';
import { CreateCheckoutDto } from '../dto/create-checkout.dto';
import { VerifyPaymentDto } from '../dto/verify-payment.dto';
import { CreateBillingSubscriptionDto } from '../dto/create-subscription.dto';
import { CancelBillingSubscriptionDto } from '../dto/cancel-subscription.dto';
import { RefundPaymentDto } from '../dto/refund-payment.dto';
import { HandleWebhookDto } from '../dto/handle-webhook.dto';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly providers = new Map<string, PaymentProvider>();

  registerProvider(name: string, provider: PaymentProvider): void {
    if (this.providers.has(name)) {
      this.logger.warn(`Provider "${name}" is already registered. Overwriting.`);
    }
    this.providers.set(name, provider);
    this.logger.log(`Payment provider registered: ${name}`);
  }

  getProvider(name: string): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotImplementedException(
        `Payment provider "${name}" is not registered. Available providers: ${[...this.providers.keys()].join(', ') || 'none'}`,
      );
    }
    return provider;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }

  async createCheckout(dto: CreateCheckoutDto) {
    const provider = this.getProvider('razorpay');
    return provider.createCheckout({
      amount: dto.amount,
      currency: dto.currency,
      organizationId: dto.organizationId,
      subscriptionId: dto.subscriptionId,
      planId: dto.planId,
      description: dto.description,
      metadata: dto.metadata,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  async verifyPayment(dto: VerifyPaymentDto) {
    const provider = this.getProvider(dto.provider);
    return provider.verifyPayment({
      sessionId: dto.sessionId,
      paymentId: dto.paymentId,
      provider: dto.provider,
      signature: dto.signature,
      metadata: dto.metadata,
    });
  }

  async createSubscription(dto: CreateBillingSubscriptionDto) {
    const provider = this.getProvider('razorpay');
    return provider.createSubscription({
      organizationId: dto.organizationId,
      planId: dto.planId,
      planName: dto.planName,
      amount: dto.amount,
      currency: dto.currency,
      interval: dto.interval,
      trialPeriodDays: dto.trialPeriodDays,
      metadata: dto.metadata,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });
  }

  async cancelSubscription(dto: CancelBillingSubscriptionDto) {
    const provider = this.getProvider(dto.provider);
    return provider.cancelSubscription({
      providerSubscriptionId: dto.providerSubscriptionId,
      provider: dto.provider,
      atPeriodEnd: dto.atPeriodEnd,
      metadata: dto.metadata,
    });
  }

  async refundPayment(dto: RefundPaymentDto) {
    const provider = this.getProvider('razorpay');
    return provider.refundPayment({
      paymentId: dto.paymentId,
      amount: dto.amount,
      reason: dto.reason,
      metadata: dto.metadata,
    });
  }

  async handleWebhook(dto: HandleWebhookDto) {
    const provider = this.getProvider(dto.provider);
    return provider.handleWebhook({
      provider: dto.provider,
      rawBody: dto.rawBody,
      headers: dto.headers,
      signature: dto.signature,
    });
  }
}
