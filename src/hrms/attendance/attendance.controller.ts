import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { AttendanceQueryDto } from './dto/attendance-query.dto';

@ApiTags('HRMS - Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hrms/organizations/:orgId/attendance')
export class AttendanceController {
  constructor(private readonly att: AttendanceService) {}

  @Post('check-in')
  @UseGuards(PermissionGuard)
  @Permissions('attendance:create')
  @ApiOperation({ summary: 'Check in employee' })
  checkIn(
    @Param('orgId') orgId: string,
    @Body() dto: CheckInDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.att.checkIn(orgId, dto, user.sub, req.requestId);
  }

  @Post('check-out')
  @UseGuards(PermissionGuard)
  @Permissions('attendance:create')
  @ApiOperation({ summary: 'Check out employee' })
  checkOut(
    @Param('orgId') orgId: string,
    @Body() dto: CheckOutDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.att.checkOut(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('attendance:read')
  @ApiOperation({ summary: 'List attendance records with filters' })
  findAll(@Param('orgId') orgId: string, @Query() query: AttendanceQueryDto) {
    return this.att.findAll(orgId, query);
  }
}
