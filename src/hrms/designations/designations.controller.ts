import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { DesignationsService } from './designations.service';
import { CreateDesignationDto } from './dto/create-designation.dto';
import { UpdateDesignationDto } from './dto/update-designation.dto';

@ApiTags('HRMS - Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hrms/organizations/:orgId/designations')
export class DesignationsController {
  constructor(private readonly desig: DesignationsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('designation:create')
  @ApiOperation({ summary: 'Create a new designation' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateDesignationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.desig.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('designation:read')
  @ApiOperation({ summary: 'List all designations' })
  findAll(@Param('orgId') orgId: string) {
    return this.desig.findAll(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('designation:read')
  @ApiOperation({ summary: 'Get designation details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.desig.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('designation:update')
  @ApiOperation({ summary: 'Update designation' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDesignationDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.desig.update(orgId, id, dto, user.sub, req.requestId);
  }
}
