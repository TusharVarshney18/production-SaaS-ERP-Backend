import { Module, OnModuleInit } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PaymentService } from './payment.service';
import { InvoiceService } from './invoice.service';
import { CouponService } from './coupon.service';
import { PaymentGatewayService } from './providers/payment-gateway.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  providers: [
    BillingService,
    PaymentService,
    InvoiceService,
    CouponService,
    PaymentGatewayService,
    RazorpayProvider,
    StripeProvider,
  ],
  exports: [BillingService, PaymentService, InvoiceService, CouponService],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly paymentGatewayService: PaymentGatewayService,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly stripeProvider: StripeProvider,
  ) {}

  onModuleInit(): void {
    this.paymentGatewayService.registerProvider('razorpay', this.razorpayProvider);
    this.paymentGatewayService.registerProvider('stripe', this.stripeProvider);
  }
}
