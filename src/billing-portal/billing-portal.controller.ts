import {
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { BillingPortalService } from './billing-portal.service';
import { UpgradePlanDto } from './dto/upgrade-plan.dto';
import { DowngradePlanDto } from './dto/downgrade-plan.dto';
import { PreviewDiscountDto } from './dto/preview-discount.dto';
import { BillingAddressDto } from './dto/billing-address.dto';
import { CompanyInfoDto } from './dto/company-info.dto';
import { TaxInfoDto } from './dto/tax-info.dto';
import { PaymentQueryDto } from '../billing/dto/payment-query.dto';
import { InvoiceQueryDto } from '../billing/dto/invoice-query.dto';
import { PlanQueryDto } from '../subscriptions/dto/plan-query.dto';

@ApiTags('Billing Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing-portal/organizations/:orgId')
export class BillingPortalController {
  constructor(private readonly portal: BillingPortalService) {}

  // ─── Subscription ────────────────────────

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription details' })
  getSubscription(@Param('orgId') orgId: string) {
    return this.portal.getCurrentSubscription(orgId);
  }

  @Patch('subscription/upgrade')
  @ApiOperation({ summary: 'Upgrade subscription plan' })
  upgrade(
    @Param('orgId') orgId: string,
    @Body() dto: UpgradePlanDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.portal.upgradePlan(orgId, dto, user.sub, req.requestId);
  }

  @Patch('subscription/downgrade')
  @ApiOperation({ summary: 'Downgrade subscription plan' })
  downgrade(
    @Param('orgId') orgId: string,
    @Body() dto: DowngradePlanDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.portal.downgradePlan(orgId, dto, user.sub, req.requestId);
  }

  @Post('subscription/cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.portal.cancelSubscription(orgId, user.sub, req.requestId);
  }

  @Post('subscription/resume')
  @ApiOperation({ summary: 'Resume cancelled subscription' })
  resume(
    @Param('orgId') orgId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.portal.resumeSubscription(orgId, user.sub, req.requestId);
  }

  @Get('subscription/trial')
  @ApiOperation({ summary: 'Get trial information' })
  getTrial(@Param('orgId') orgId: string) {
    return this.portal.getTrialInfo(orgId);
  }

  @Get('subscription/renewal')
  @ApiOperation({ summary: 'Get renewal information' })
  getRenewal(@Param('orgId') orgId: string) {
    return this.portal.getRenewalInfo(orgId);
  }

  // ─── Plans ────────────────────────────────

  @Get('plans')
  @ApiOperation({ summary: 'Get available plans' })
  getPlans(@Query() query: PlanQueryDto) {
    return this.portal.getAvailablePlans(query);
  }

  @Get('plans/compare')
  @ApiOperation({ summary: 'Compare all active plans' })
  comparePlans() {
    return this.portal.comparePlans();
  }

  // ─── Invoices ─────────────────────────────

  @Get('invoices')
  @ApiOperation({ summary: 'Get invoice history' })
  getInvoices(@Param('orgId') orgId: string, @Query() query: InvoiceQueryDto) {
    return this.portal.getInvoiceHistory(orgId, query);
  }

  @Get('invoices/upcoming')
  @ApiOperation({ summary: 'Get upcoming invoice' })
  getUpcomingInvoice(@Param('orgId') orgId: string) {
    return this.portal.getUpcomingInvoice(orgId);
  }

  @Get('invoices/:invoiceId')
  @ApiOperation({ summary: 'Get invoice details' })
  getInvoice(@Param('orgId') orgId: string, @Param('invoiceId') invoiceId: string) {
    return this.portal.getInvoiceDetails(orgId, invoiceId);
  }

  @Get('invoices/:invoiceId/download')
  @ApiOperation({ summary: 'Download invoice metadata' })
  downloadInvoice(@Param('orgId') orgId: string, @Param('invoiceId') invoiceId: string) {
    return this.portal.getInvoiceDownload(orgId, invoiceId);
  }

  // ─── Payments ─────────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'Get payment history' })
  getPayments(@Param('orgId') orgId: string, @Query() query: PaymentQueryDto) {
    return this.portal.getPaymentHistory(orgId, query);
  }

  @Get('payments/:paymentId')
  @ApiOperation({ summary: 'Get payment details' })
  getPayment(@Param('orgId') orgId: string, @Param('paymentId') paymentId: string) {
    return this.portal.getPaymentDetails(orgId, paymentId);
  }

  @Get('payments/:paymentId/status')
  @ApiOperation({ summary: 'Get payment status' })
  getPaymentStatus(@Param('orgId') orgId: string, @Param('paymentId') paymentId: string) {
    return this.portal.getPaymentStatus(orgId, paymentId);
  }

  // ─── Usage ────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: 'Get current usage' })
  getUsage(@Param('orgId') orgId: string) {
    return this.portal.getCurrentUsage(orgId);
  }

  @Get('usage/remaining')
  @ApiOperation({ summary: 'Get remaining limits' })
  getRemaining(@Param('orgId') orgId: string) {
    return this.portal.getRemainingLimits(orgId);
  }

  @Get('usage/history')
  @ApiOperation({ summary: 'Get usage history' })
  getUsageHistory(@Param('orgId') orgId: string) {
    return this.portal.getUsageHistory(orgId);
  }

  // ─── Features ─────────────────────────────

  @Get('features')
  @ApiOperation({ summary: 'Get current plan features' })
  getFeatures(@Param('orgId') orgId: string) {
    return this.portal.getCurrentPlanFeatures(orgId);
  }

  @Get('features/locked')
  @ApiOperation({ summary: 'Get locked (unavailable) features' })
  getLockedFeatures(@Param('orgId') orgId: string) {
    return this.portal.getLockedFeatures(orgId);
  }

  @Get('features/:slug/availability')
  @ApiOperation({ summary: 'Check feature availability' })
  getFeatureAvailability(@Param('orgId') orgId: string, @Param('slug') slug: string) {
    return this.portal.getFeatureAvailability(orgId, slug);
  }

  // ─── Coupons ──────────────────────────────

  @Post('coupons/validate')
  @ApiOperation({ summary: 'Validate a coupon code' })
  validateCoupon(@Param('orgId') orgId: string, @Body() dto: PreviewDiscountDto) {
    return this.portal.validateCoupon(orgId, dto);
  }

  @Post('coupons/preview')
  @ApiOperation({ summary: 'Preview discount from a coupon' })
  previewDiscount(@Param('orgId') orgId: string, @Body() dto: PreviewDiscountDto) {
    return this.portal.previewDiscount(orgId, dto);
  }

  @Post('coupons/apply')
  @ApiOperation({ summary: 'Apply a coupon' })
  applyCoupon(@Param('orgId') orgId: string, @Body() dto: PreviewDiscountDto) {
    return this.portal.applyCoupon(orgId, dto);
  }

  // ─── Billing Profile ──────────────────────

  @Get('billing-address')
  @ApiOperation({ summary: 'Get billing address' })
  getBillingAddress(@Param('orgId') orgId: string) {
    return this.portal.getBillingAddress(orgId);
  }

  @Put('billing-address')
  @ApiOperation({ summary: 'Update billing address' })
  updateBillingAddress(@Param('orgId') orgId: string, @Body() dto: BillingAddressDto) {
    return this.portal.upsertBillingAddress(orgId, dto);
  }

  @Get('company-info')
  @ApiOperation({ summary: 'Get company information' })
  getCompanyInfo(@Param('orgId') orgId: string) {
    return this.portal.getCompanyInfo(orgId);
  }

  @Put('company-info')
  @ApiOperation({ summary: 'Update company information' })
  updateCompanyInfo(@Param('orgId') orgId: string, @Body() dto: CompanyInfoDto) {
    return this.portal.updateCompanyInfo(orgId, dto);
  }

  @Get('tax-info')
  @ApiOperation({ summary: 'Get tax information' })
  getTaxInfo(@Param('orgId') orgId: string) {
    return this.portal.getTaxInfo(orgId);
  }

  @Put('tax-info')
  @ApiOperation({ summary: 'Update tax information' })
  updateTaxInfo(@Param('orgId') orgId: string, @Body() dto: TaxInfoDto) {
    return this.portal.updateTaxInfo(orgId, dto);
  }
}
