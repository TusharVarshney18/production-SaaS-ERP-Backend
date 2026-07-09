import { Module, OnModuleInit } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymentService } from './payment.service';
import { InvoiceService } from './invoice.service';
import { CouponService } from './coupon.service';
import { PaymentProviderFactory } from './providers/payment-provider.factory';
import { PaymentGatewayService } from './services/payment-gateway.service';
import { RazorpayProvider } from './providers/razorpay/razorpay.provider';
import { StripeProvider } from './providers/stripe/stripe.provider';

@Module({
  providers: [
    BillingService,
    PaymentService,
    InvoiceService,
    CouponService,
    PaymentProviderFactory,
    PaymentGatewayService,
    RazorpayProvider,
    StripeProvider,
  ],
  exports: [BillingService, PaymentService, InvoiceService, CouponService, PaymentGatewayService],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly factory: PaymentProviderFactory,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly stripeProvider: StripeProvider,
  ) {}

  onModuleInit(): void {
    this.factory.register('razorpay', this.razorpayProvider);
    this.factory.register('stripe', this.stripeProvider);
  }
}
