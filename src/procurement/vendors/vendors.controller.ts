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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { VendorsService } from './vendors.service';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorQueryDto } from './dto/vendor-query.dto';

@ApiTags('Procurement - Vendors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement/organizations/:orgId/vendors')
export class VendorsController {
  constructor(private readonly vendors: VendorsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('vendor:create')
  @ApiOperation({ summary: 'Create a new vendor' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.vendors.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('vendor:read')
  @ApiOperation({ summary: 'List vendors with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: VendorQueryDto) {
    return this.vendors.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('vendor:read')
  @ApiOperation({ summary: 'Get vendor details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.vendors.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('vendor:update')
  @ApiOperation({ summary: 'Update vendor' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.vendors.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('vendor:update')
  @ApiOperation({ summary: 'Archive vendor (set inactive)' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.vendors.archive(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('vendor:update')
  @ApiOperation({ summary: 'Restore vendor (set active)' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.vendors.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('vendor:delete')
  @ApiOperation({ summary: 'Soft delete vendor' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.vendors.delete(orgId, id, user.sub, req.requestId);
  }
}
