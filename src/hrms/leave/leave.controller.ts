import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { LeaveService } from './leave.service';
import { ApplyLeaveDto } from './dto/apply-leave.dto';
import { LeaveQueryDto } from './dto/leave-query.dto';

@ApiTags('HRMS - Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hrms/organizations/:orgId/leave')
export class LeaveController {
  constructor(private readonly leave: LeaveService) {}

  @Post('apply')
  @UseGuards(PermissionGuard)
  @Permissions('leave:create')
  @ApiOperation({ summary: 'Apply for leave' })
  apply(
    @Param('orgId') orgId: string,
    @Body() dto: ApplyLeaveDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.leave.apply(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('leave:read')
  @ApiOperation({ summary: 'List leave requests' })
  findAll(@Param('orgId') orgId: string, @Query() query: LeaveQueryDto) {
    return this.leave.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('leave:read')
  @ApiOperation({ summary: 'Get leave request details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.leave.findOne(orgId, id);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions('leave:approve')
  @ApiOperation({ summary: 'Approve leave request' })
  approve(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.leave.approve(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/reject')
  @UseGuards(PermissionGuard)
  @Permissions('leave:reject')
  @ApiOperation({ summary: 'Reject leave request' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  reject(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.leave.reject(orgId, id, reason || null, user.sub, req.requestId);
  }
}
