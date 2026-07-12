import { Controller, Get, Post, Patch, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@ApiTags('HRMS - Departments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hrms/organizations/:orgId/departments')
export class DepartmentsController {
  constructor(private readonly dept: DepartmentsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('department:create')
  @ApiOperation({ summary: 'Create a new department' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.dept.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('department:read')
  @ApiOperation({ summary: 'List all departments' })
  findAll(@Param('orgId') orgId: string) {
    return this.dept.findAll(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('department:read')
  @ApiOperation({ summary: 'Get department details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.dept.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('department:update')
  @ApiOperation({ summary: 'Update department' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.dept.update(orgId, id, dto, user.sub, req.requestId);
  }
}
