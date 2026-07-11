import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SuperAdminService } from './super-admin.service';
import { SuperAdminOrgQueryDto } from './dto/super-admin-org-query.dto';
import { ChangeOrgPlanDto } from './dto/change-org-plan.dto';
import { OverrideUsageLimitsDto } from './dto/override-usage-limits.dto';
import { OverrideFeatureFlagsDto } from './dto/override-feature-flags.dto';
import { DuplicatePlanDto } from './dto/duplicate-plan.dto';
import { PlanPricingDto } from './dto/plan-pricing.dto';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateSystemSettingDto } from './dto/update-system-setting.dto';
import { CreatePlanDto } from '../subscriptions/dto/create-plan.dto';
import { UpdatePlanDto } from '../subscriptions/dto/update-plan.dto';

@ApiTags('Super Admin')
@ApiBearerAuth()
@UseGuards(SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly admin: SuperAdminService) {}

  // ─── Dashboard ────────────────────────────

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get platform statistics' })
  getDashboardStats() {
    return this.admin.getDashboardStats();
  }

  // ─── Organizations ────────────────────────

  @Get('organizations')
  @ApiOperation({ summary: 'List/search/filter organizations' })
  listOrganizations(@Query() query: SuperAdminOrgQueryDto) {
    return this.admin.listOrganizations(query);
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Get organization details' })
  getOrganization(@Param('id') id: string) {
    return this.admin.getOrganizationDetail(id);
  }

  @Patch('organizations/:id/suspend')
  @ApiOperation({ summary: 'Suspend organization' })
  suspendOrg(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.suspendOrganization(id, user.sub, req.requestId);
  }

  @Patch('organizations/:id/restore')
  @ApiOperation({ summary: 'Restore suspended organization' })
  restoreOrg(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.restoreOrganization(id, user.sub, req.requestId);
  }

  @Delete('organizations/:id')
  @ApiOperation({ summary: 'Soft delete organization' })
  deleteOrg(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.softDeleteOrganization(id, user.sub, req.requestId);
  }

  @Patch('organizations/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate deleted organization' })
  reactivateOrg(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.reactivateOrganization(id, user.sub, req.requestId);
  }

  @Patch('organizations/:id/plan')
  @ApiOperation({ summary: 'Change organization plan' })
  changeOrgPlan(
    @Param('id') id: string,
    @Body() dto: ChangeOrgPlanDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.changeOrganizationPlan(id, dto, user.sub, req.requestId);
  }

  @Patch('organizations/:id/usage-limits')
  @ApiOperation({ summary: 'Override usage limits for organization' })
  overrideUsageLimits(
    @Param('id') id: string,
    @Body() dto: OverrideUsageLimitsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.overrideUsageLimits(id, dto, user.sub, req.requestId);
  }

  @Patch('organizations/:id/features')
  @ApiOperation({ summary: 'Override feature flags for organization' })
  overrideFeatures(
    @Param('id') id: string,
    @Body() dto: OverrideFeatureFlagsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.overrideFeatureFlags(id, dto, user.sub, req.requestId);
  }

  // ─── Plans ────────────────────────────────

  @Post('plans')
  @ApiOperation({ summary: 'Create subscription plan' })
  createPlan(@Body() dto: CreatePlanDto) {
    return this.admin.createPlan(dto as never);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update subscription plan' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.admin.updatePlan(id, dto as never);
  }

  @Patch('plans/:id/archive')
  @ApiOperation({ summary: 'Archive plan' })
  archivePlan(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.archivePlan(id, user.sub, req.requestId);
  }

  @Patch('plans/:id/restore')
  @ApiOperation({ summary: 'Restore archived plan' })
  restorePlan(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.restorePlan(id, req.requestId, user.sub);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Soft delete plan' })
  deletePlan(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.deletePlan(id, user.sub, req.requestId);
  }

  @Post('plans/:id/duplicate')
  @ApiOperation({ summary: 'Duplicate plan' })
  duplicatePlan(
    @Param('id') id: string,
    @Body() dto: DuplicatePlanDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.duplicatePlan(id, dto, req.requestId, user.sub);
  }

  @Patch('plans/:id/pricing')
  @ApiOperation({ summary: 'Update plan pricing' })
  updatePricing(
    @Param('id') id: string,
    @Body() dto: PlanPricingDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.admin.updatePlanPricing(id, dto, user.sub, req.requestId);
  }

  // ─── Features ─────────────────────────────

  @Post('features')
  @ApiOperation({ summary: 'Create feature' })
  createFeature(@Body() dto: { name: string; slug: string; description?: string; group?: string }) {
    return this.admin.createFeature(dto);
  }

  @Patch('features/:id')
  @ApiOperation({ summary: 'Update feature' })
  updateFeature(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; group?: string },
  ) {
    return this.admin.updateFeature(id, dto);
  }

  @Delete('features/:id')
  @ApiOperation({ summary: 'Delete feature' })
  deleteFeature(@Param('id') id: string) {
    return this.admin.deleteFeature(id);
  }

  @Post('features/:featureId/assign/:planId')
  @ApiOperation({ summary: 'Assign feature to plan' })
  assignFeature(
    @Param('planId') planId: string,
    @Param('featureId') featureId: string,
    @Body('value') value?: string,
  ) {
    return this.admin.assignFeatureToPlan(planId, featureId, value);
  }

  @Delete('features/:featureId/remove/:planId')
  @ApiOperation({ summary: 'Remove feature from plan' })
  removeFeature(@Param('planId') planId: string, @Param('featureId') featureId: string) {
    return this.admin.removeFeatureFromPlan(planId, featureId);
  }

  @Patch('plan-features/:id/enable')
  @ApiOperation({ summary: 'Enable feature for plan' })
  enableFeature(@Param('id') id: string) {
    return this.admin.enableFeature(id);
  }

  @Patch('plan-features/:id/disable')
  @ApiOperation({ summary: 'Disable feature for plan' })
  disableFeature(@Param('id') id: string) {
    return this.admin.disableFeature(id);
  }

  // ─── Coupons ──────────────────────────────

  @Get('coupons')
  @ApiOperation({ summary: 'List all coupons' })
  listCoupons() {
    return this.admin.listCoupons();
  }

  @Get('coupons/analytics')
  @ApiOperation({ summary: 'Coupon usage analytics' })
  couponAnalytics() {
    return this.admin.getCouponAnalytics();
  }

  @Patch('coupons/:id/disable')
  @ApiOperation({ summary: 'Disable coupon' })
  disableCoupon(@Param('id') id: string) {
    return this.admin.disableCoupon(id);
  }

  @Post('coupons/:id/expire')
  @ApiOperation({ summary: 'Expire coupon' })
  expireCoupon(@Param('id') id: string) {
    return this.admin.expireCoupon(id);
  }

  @Delete('coupons/:id')
  @ApiOperation({ summary: 'Delete coupon' })
  deleteCoupon(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.admin.deleteCoupon(id, user.sub);
  }

  // ─── Payments ─────────────────────────────

  @Get('payments')
  @ApiOperation({ summary: 'All payments' })
  getAllPayments(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getAllPayments(page, limit);
  }

  @Get('payments/failed')
  @ApiOperation({ summary: 'Failed payments' })
  getFailedPayments(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getFailedPayments(page, limit);
  }

  @Get('payments/refunded')
  @ApiOperation({ summary: 'Refunded payments' })
  getRefundedPayments(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.admin.getRefundedPayments(page, limit);
  }

  @Get('payments/revenue')
  @ApiOperation({ summary: 'Revenue statistics' })
  getRevenue() {
    return this.admin.getRevenueStats();
  }

  @Get('payments/mrr')
  @ApiOperation({ summary: 'Monthly Recurring Revenue' })
  getMrr() {
    return this.admin.getMrr();
  }

  @Get('payments/arr')
  @ApiOperation({ summary: 'Annual Recurring Revenue' })
  getArr() {
    return this.admin.getArr();
  }

  // ─── Invoices ─────────────────────────────

  @Get('invoices')
  @ApiOperation({ summary: 'All invoices' })
  getAllInvoices(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.admin.getAllInvoices(page, limit, search);
  }

  @Get('invoices/:id/download')
  @ApiOperation({ summary: 'Download invoice metadata' })
  downloadInvoice(@Param('id') id: string) {
    return this.admin.downloadInvoiceMeta(id);
  }

  // ─── Announcements ────────────────────────

  @Post('announcements')
  @ApiOperation({ summary: 'Create announcement' })
  createAnnouncement(@Body() dto: CreateAnnouncementDto) {
    return this.admin.createAnnouncement(dto);
  }

  @Patch('announcements/:id/publish')
  @ApiOperation({ summary: 'Publish announcement' })
  publishAnnouncement(@Param('id') id: string) {
    return this.admin.publishAnnouncement(id);
  }

  @Patch('announcements/:id/schedule')
  @ApiOperation({ summary: 'Schedule announcement' })
  scheduleAnnouncement(@Param('id') id: string, @Body('startsAt') startsAt: string) {
    return this.admin.scheduleAnnouncement(id, startsAt);
  }

  // ─── System Settings ──────────────────────

  @Get('settings')
  @ApiOperation({ summary: 'Get all system settings' })
  getSettings() {
    return this.admin.getSystemSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update system setting' })
  updateSetting(@Body() dto: UpdateSystemSettingDto) {
    return this.admin.updateSystemSetting(dto);
  }

  // ─── Audit Logs ───────────────────────────

  @Get('audit-logs')
  @ApiOperation({ summary: 'Global audit log search' })
  getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.admin.getAuditLogs(page, limit, search);
  }
}
