import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { AuditLogService } from './audit-log.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';

@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('audit_log:read')
  @ApiOperation({ summary: 'List audit logs' })
  async findAll(@CurrentUser() user: JwtPayload, @Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll(user.org, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('audit_log:read')
  @ApiOperation({ summary: 'Get audit log entry by ID' })
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.auditLogService.findById(user.org, id);
  }
}
