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
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityQueryDto } from './dto/activity-query.dto';
import { AssignActivityDto } from './dto/assign-activity.dto';
import { ChangeDueDateDto } from './dto/change-due-date.dto';
import { ChangePriorityDto } from './dto/change-priority.dto';

@ApiTags('CRM - Activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm/organizations/:orgId/activities')
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('activity:create')
  @ApiOperation({ summary: 'Create a new activity' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateActivityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('activity:read')
  @ApiOperation({ summary: 'List activities with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: ActivityQueryDto) {
    return this.activities.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('activity:read')
  @ApiOperation({ summary: 'Get activity details with timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.activities.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Update activity' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/complete')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Mark activity as completed' })
  complete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.complete(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/cancel')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Cancel activity' })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.cancel(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Archive activity' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.archive(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Restore activity from archive' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('activity:delete')
  @ApiOperation({ summary: 'Soft delete activity' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.delete(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/assign')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Assign activity to user' })
  assign(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AssignActivityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.assign(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/change-due-date')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Change activity due date' })
  changeDueDate(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ChangeDueDateDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.changeDueDate(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/change-priority')
  @UseGuards(PermissionGuard)
  @Permissions('activity:update')
  @ApiOperation({ summary: 'Change activity priority' })
  changePriority(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: ChangePriorityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.activities.changePriority(orgId, id, dto, user.sub, req.requestId);
  }

  @Get(':id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('activity:read')
  @ApiOperation({ summary: 'Get activity timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activities.getTimeline(orgId, id, page, limit);
  }
}
