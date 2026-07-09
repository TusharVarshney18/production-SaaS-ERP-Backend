import { Module, OnModuleInit } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { RazorpayProvider } from './providers/razorpay.provider';
import { StripeProvider } from './providers/stripe.provider';

@Module({
  providers: [PaymentService, RazorpayProvider, StripeProvider],
  exports: [PaymentService],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly razorpayProvider: RazorpayProvider,
    private readonly stripeProvider: StripeProvider,
  ) {}

  onModuleInit(): void {
    this.paymentService.registerProvider('razorpay', this.razorpayProvider);
    this.paymentService.registerProvider('stripe', this.stripeProvider);
  }
}
