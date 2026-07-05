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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { PermissionGuard } from '../authorization/guards/permission.guard';

@ApiTags('Organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  async create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all organizations' })
  async findAll(@Query() query: OrganizationQueryDto) {
    return this.organizationsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  async findOne(@Param('id') id: string) {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('organization:update')
  @ApiOperation({ summary: 'Update organization' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.organizationsService.update(id, dto, user.sub);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('organization:delete')
  @ApiOperation({ summary: 'Soft delete organization' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    await this.organizationsService.softDelete(id, user.sub, reason);
    return { message: 'Organization deleted successfully' };
  }

  @Patch(':id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('organization:update')
  @ApiOperation({ summary: 'Restore soft-deleted organization' })
  async restore(@Param('id') id: string) {
    await this.organizationsService.restore(id);
    return { message: 'Organization restored successfully' };
  }
}
