import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrganizationSettingsService } from './organization-settings.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';

@ApiTags('Organization Settings')
@Controller('organizations/:orgId/settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationSettingsController {
  constructor(private readonly settingsService: OrganizationSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get organization settings' })
  async findOne(@Param('orgId') orgId: string) {
    return this.settingsService.findByOrganizationId(orgId);
  }

  @Patch()
  @UseGuards(PermissionGuard)
  @Permissions('organization:update')
  @ApiOperation({ summary: 'Update organization settings' })
  async update(@Param('orgId') orgId: string, @Body() dto: UpdateOrganizationSettingsDto) {
    return this.settingsService.upsert(orgId, dto);
  }
}
