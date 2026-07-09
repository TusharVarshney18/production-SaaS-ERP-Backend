import { Injectable, Logger } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { InvoiceService } from './invoice.service';
import { CouponService } from './coupon.service';
import { PaymentGatewayService } from './providers/payment-gateway.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    public readonly payments: PaymentService,
    public readonly invoices: InvoiceService,
    public readonly coupons: CouponService,
    public readonly gateway: PaymentGatewayService,
  ) {
    this.logger.log('BillingService initialized');
  }
}
