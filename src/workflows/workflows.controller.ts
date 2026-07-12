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
import { WorkflowDefinitionsService } from './services/workflow-definitions.service';
import { EventBusService } from './events/event-bus.service';
import { BusinessEvent, BUSINESS_EVENTS } from './events/business-events';

@ApiTags('Workflow Automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workflows/organizations/:orgId')
export class WorkflowsController {
  constructor(
    private readonly definitions: WorkflowDefinitionsService,
    private readonly eventBus: EventBusService,
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'List all available business events' })
  listEvents() {
    return BUSINESS_EVENTS;
  }

  @Post('definitions')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:create')
  @ApiOperation({ summary: 'Create a workflow definition' })
  create(
    @Param('orgId') orgId: string,
    @Body()
    dto: {
      name: string;
      event: string;
      conditions?: Record<string, unknown>;
      isActive?: boolean;
      actions: { type: string; config: Record<string, unknown>; order: number }[];
    },
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.definitions.create(orgId, dto, user.sub, req.requestId);
  }

  @Get('definitions')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:read')
  @ApiOperation({ summary: 'List workflow definitions' })
  findAll(@Param('orgId') orgId: string) {
    return this.definitions.findAll(orgId);
  }

  @Get('definitions/:id')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:read')
  @ApiOperation({ summary: 'Get workflow definition details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.definitions.findOne(orgId, id);
  }

  @Patch('definitions/:id')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Update workflow definition' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      event?: string;
      conditions?: Record<string, unknown> | null;
      isActive?: boolean;
    },
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.definitions.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('definitions/:id/toggle')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:update')
  @ApiOperation({ summary: 'Toggle workflow active/inactive' })
  toggle(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.definitions.toggleActive(orgId, id, user.sub, req.requestId);
  }

  @Delete('definitions/:id')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:delete')
  @ApiOperation({ summary: 'Delete workflow definition' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.definitions.delete(orgId, id, user.sub, req.requestId);
  }

  @Get('executions')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:read')
  @ApiOperation({ summary: 'Get workflow execution logs' })
  getExecutions(
    @Param('orgId') orgId: string,
    @Query('workflowId') workflowId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.definitions.getExecutionLogs(orgId, workflowId, page, limit);
  }

  @Post('emit/:event')
  @UseGuards(PermissionGuard)
  @Permissions('workflow:emit')
  @ApiOperation({ summary: 'Manually emit a business event (for testing)' })
  async emitEvent(
    @Param('orgId') orgId: string,
    @Param('event') event: string,
    @Body() payload: { resourceId: string; data?: Record<string, unknown> },
    @CurrentUser() _user: JwtPayload,
  ) {
    await this.eventBus.emit({
      organizationId: orgId,
      event: event as BusinessEvent,
      resourceId: payload.resourceId,
      data: payload.data,
      occurredAt: new Date(),
    });
    return { message: 'Event emitted', event, resourceId: payload.resourceId };
  }
}
