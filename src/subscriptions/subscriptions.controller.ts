import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { SubscriptionsService } from './subscriptions.service';
import { FeatureService } from './feature.service';
import { UsageService } from './usage.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanQueryDto } from './dto/plan-query.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ChangePlanDto } from './dto/change-plan.dto';
import { CheckFeatureDto } from './dto/check-feature.dto';
import { IncrementUsageDto } from './dto/increment-usage.dto';

@ApiTags('Subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly featureService: FeatureService,
    private readonly usageService: UsageService,
  ) {}

  // ──────────────────────────────────────────────
  // SubscriptionPlan CRUD
  // ──────────────────────────────────────────────

  @Post('plans')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  async createPlan(@Body() dto: CreatePlanDto) {
    return this.subscriptionsService.createPlan(dto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List all subscription plans' })
  async findAllPlans(@Query() query: PlanQueryDto) {
    return this.subscriptionsService.findAllPlans(query);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get plan details by ID' })
  async findPlanById(@Param('id') id: string) {
    return this.subscriptionsService.findPlanById(id);
  }

  @Patch('plans/:id')
  @ApiOperation({ summary: 'Update a subscription plan' })
  async updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.subscriptionsService.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @ApiOperation({ summary: 'Soft delete a subscription plan' })
  async deletePlan(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    await this.subscriptionsService.softDeletePlan(id, user.sub, reason);
    return { message: 'Plan deleted successfully' };
  }

  // ──────────────────────────────────────────────
  // OrganizationSubscription Lifecycle
  // ──────────────────────────────────────────────

  @Post('organizations/:orgId/subscription')
  @ApiOperation({ summary: 'Activate trial subscription for an organization' })
  async activateTrial(@Param('orgId') orgId: string, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionsService.activateTrial(orgId, dto);
  }

  @Get('organizations/:orgId/subscription')
  @ApiOperation({ summary: 'Get current subscription for an organization' })
  async getSubscription(@Param('orgId') orgId: string) {
    return this.subscriptionsService.getSubscription(orgId);
  }

  @Patch('organizations/:orgId/subscription/plan')
  @ApiOperation({ summary: 'Change subscription plan (upgrade/downgrade)' })
  async changePlan(@Param('orgId') orgId: string, @Body() dto: ChangePlanDto) {
    return this.subscriptionsService.changePlan(orgId, dto);
  }

  @Post('organizations/:orgId/subscription/cancel')
  @ApiOperation({ summary: 'Cancel subscription (at period end)' })
  async cancel(@Param('orgId') orgId: string) {
    return this.subscriptionsService.cancelSubscription(orgId);
  }

  @Post('organizations/:orgId/subscription/renew')
  @ApiOperation({ summary: 'Renew or reactivate subscription' })
  async renew(@Param('orgId') orgId: string) {
    return this.subscriptionsService.renewSubscription(orgId);
  }

  @Post('organizations/:orgId/subscription/expire')
  @ApiOperation({ summary: 'Manually expire a subscription' })
  async expire(@Param('orgId') orgId: string) {
    return this.subscriptionsService.expireSubscription(orgId);
  }

  @Post('expired/process')
  @ApiOperation({ summary: 'Process all expired subscriptions (cron)' })
  async processExpired() {
    return this.subscriptionsService.handleExpiredSubscriptions();
  }

  // ──────────────────────────────────────────────
  // Feature Resolution
  // ──────────────────────────────────────────────

  @Get('organizations/:orgId/features')
  @ApiOperation({ summary: 'Get all enabled features for an organization' })
  async getFeatures(@Param('orgId') orgId: string) {
    return this.featureService.getOrganizationFeatures(orgId);
  }

  @Post('organizations/:orgId/features/check')
  @ApiOperation({ summary: 'Check if a specific feature is available' })
  async checkFeature(@Param('orgId') orgId: string, @Body() dto: CheckFeatureDto) {
    return this.featureService.checkFeature(orgId, dto.featureSlug);
  }

  // ──────────────────────────────────────────────
  // Usage Limits
  // ──────────────────────────────────────────────

  @Get('organizations/:orgId/usage')
  @ApiOperation({ summary: 'Get usage counters for an organization' })
  async getUsage(@Param('orgId') orgId: string) {
    return this.usageService.getUsage(orgId);
  }

  @Post('organizations/:orgId/usage/check')
  @ApiOperation({ summary: 'Check usage against limit for a feature' })
  async checkUsage(@Param('orgId') orgId: string, @Body() dto: CheckFeatureDto) {
    return this.usageService.checkUsage(orgId, dto.featureSlug);
  }

  @Post('organizations/:orgId/usage/increment')
  @ApiOperation({ summary: 'Increment usage counter for a feature' })
  async incrementUsage(@Param('orgId') orgId: string, @Body() dto: IncrementUsageDto) {
    return this.usageService.incrementUsage(orgId, dto.featureSlug, dto.amount ?? 1, dto.period);
  }
}
