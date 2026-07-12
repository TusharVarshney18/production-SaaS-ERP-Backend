import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DealsService } from './deals.service';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { UpdatePipelineDto } from './dto/update-pipeline.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { UpdateStageDto } from './dto/update-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
import { CreateDealDto } from './dto/create-deal.dto';
import { UpdateDealDto } from './dto/update-deal.dto';
import { DealQueryDto } from './dto/deal-query.dto';
import { MoveStageDto } from './dto/move-stage.dto';
import { ChangeOwnerDto } from './dto/change-owner.dto';
import { MarkWonDto } from './dto/mark-won.dto';
import { MarkLostDto } from './dto/mark-lost.dto';

@ApiTags('CRM - Deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm/organizations/:orgId')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  // ─── Pipeline ─────────────────────────────

  @Post('pipelines')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:create')
  @ApiOperation({ summary: 'Create a new pipeline' })
  createPipeline(
    @Param('orgId') orgId: string,
    @Body() dto: CreatePipelineDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.createPipeline(orgId, dto, user.sub, req.requestId);
  }

  @Get('pipelines')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:read')
  @ApiOperation({ summary: 'List all pipelines with stages' })
  listPipelines(@Param('orgId') orgId: string) {
    return this.deals.listPipelines(orgId);
  }

  @Get('pipelines/:id')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:read')
  @ApiOperation({ summary: 'Get pipeline details with stages' })
  findOnePipeline(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.deals.findOnePipeline(orgId, id);
  }

  @Patch('pipelines/:id')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:update')
  @ApiOperation({ summary: 'Update pipeline' })
  updatePipeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdatePipelineDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.updatePipeline(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('pipelines/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:update')
  @ApiOperation({ summary: 'Archive pipeline' })
  archivePipeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.archivePipeline(orgId, id, user.sub, req.requestId);
  }

  @Post('pipelines/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:update')
  @ApiOperation({ summary: 'Restore pipeline from archive' })
  restorePipeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.restorePipeline(orgId, id, user.sub, req.requestId);
  }

  @Delete('pipelines/:id')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:delete')
  @ApiOperation({ summary: 'Delete pipeline (hard delete)' })
  deletePipeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.deletePipeline(orgId, id, user.sub, req.requestId);
  }

  // ─── Stages ───────────────────────────────

  @Post('pipelines/:pipelineId/stages')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:update')
  @ApiOperation({ summary: 'Create a new stage in pipeline' })
  createStage(
    @Param('orgId') orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: CreateStageDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.createStage(orgId, pipelineId, dto, user.sub, req.requestId);
  }

  @Patch('pipelines/:pipelineId/stages/:stageId')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:update')
  @ApiOperation({ summary: 'Update pipeline stage' })
  updateStage(
    @Param('orgId') orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
    @Body() dto: UpdateStageDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.updateStage(orgId, pipelineId, stageId, dto, user.sub, req.requestId);
  }

  @Post('pipelines/:pipelineId/stages/reorder')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:update')
  @ApiOperation({ summary: 'Reorder stages in pipeline' })
  reorderStages(
    @Param('orgId') orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Body() dto: ReorderStagesDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.reorderStages(orgId, pipelineId, dto, user.sub, req.requestId);
  }

  @Delete('pipelines/:pipelineId/stages/:stageId')
  @UseGuards(PermissionGuard)
  @Permissions('pipeline:delete')
  @ApiOperation({ summary: 'Delete pipeline stage (hard delete)' })
  deleteStage(
    @Param('orgId') orgId: string,
    @Param('pipelineId') pipelineId: string,
    @Param('stageId') stageId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.deleteStage(orgId, pipelineId, stageId, user.sub, req.requestId);
  }

  // ─── Deals ────────────────────────────────

  @Post('deals')
  @UseGuards(PermissionGuard)
  @Permissions('deal:create')
  @ApiOperation({ summary: 'Create a new deal' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateDealDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.create(orgId, dto, user.sub, req.requestId);
  }

  @Get('deals')
  @UseGuards(PermissionGuard)
  @Permissions('deal:read')
  @ApiOperation({ summary: 'List deals with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: DealQueryDto) {
    return this.deals.findAll(orgId, query);
  }

  @Get('deals/stats')
  @UseGuards(PermissionGuard)
  @Permissions('deal:read')
  @ApiOperation({ summary: 'Get deal dashboard statistics' })
  getStats(@Param('orgId') orgId: string) {
    return this.deals.getDashboardStats(orgId);
  }

  @Get('deals/:id')
  @UseGuards(PermissionGuard)
  @Permissions('deal:read')
  @ApiOperation({ summary: 'Get deal details with timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.deals.findOne(orgId, id);
  }

  @Patch('deals/:id')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Update deal' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('deals/:id/move-stage')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Move deal to another stage' })
  moveStage(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: MoveStageDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.moveStage(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('deals/:id/change-owner')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Change deal owner' })
  changeOwner(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ChangeOwnerDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.changeOwner(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('deals/:id/mark-won')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Mark deal as won' })
  markWon(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: MarkWonDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.markWon(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('deals/:id/mark-lost')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Mark deal as lost' })
  markLost(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: MarkLostDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.markLost(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('deals/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Archive deal' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.archive(orgId, id, user.sub, req.requestId);
  }

  @Post('deals/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('deal:update')
  @ApiOperation({ summary: 'Restore deal from archive' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete('deals/:id')
  @UseGuards(PermissionGuard)
  @Permissions('deal:delete')
  @ApiOperation({ summary: 'Soft delete deal' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.deals.delete(orgId, id, user.sub, req.requestId);
  }

  @Get('deals/:id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('deal:read')
  @ApiOperation({ summary: 'Get deal timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.deals.getTimeline(orgId, id, page, limit);
  }
}
