import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';

@ApiTags('HRMS - Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hrms/organizations/:orgId/employees')
export class EmployeesController {
  constructor(private readonly emp: EmployeesService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('employee:create')
  @ApiOperation({ summary: 'Create a new employee' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateEmployeeDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.emp.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('employee:read')
  @ApiOperation({ summary: 'List employees with search and filters' })
  findAll(@Param('orgId') orgId: string, @Query() query: EmployeeQueryDto) {
    return this.emp.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('employee:read')
  @ApiOperation({ summary: 'Get employee details with relations' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.emp.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('employee:update')
  @ApiOperation({ summary: 'Update employee' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.emp.update(orgId, id, dto, user.sub, req.requestId);
  }
}
