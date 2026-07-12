import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { TransferService } from './transfer.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { TransferQueryDto } from './dto/transfer-query.dto';

@ApiTags('Inventory - Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory/organizations/:orgId/transfers')
export class TransferController {
  constructor(private readonly transfer: TransferService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('transfer:create')
  @ApiOperation({ summary: 'Create a new inventory transfer' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.transfer.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('transfer:read')
  @ApiOperation({ summary: 'List transfers with filters and pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: TransferQueryDto) {
    return this.transfer.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('transfer:read')
  @ApiOperation({ summary: 'Get transfer details' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.transfer.findOne(orgId, id);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions('transfer:approve')
  @ApiOperation({ summary: 'Approve transfer (set to in-transit)' })
  approve(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.transfer.approve(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/complete')
  @UseGuards(PermissionGuard)
  @Permissions('transfer:complete')
  @ApiOperation({ summary: 'Complete transfer (moves stock)' })
  complete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.transfer.complete(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/cancel')
  @UseGuards(PermissionGuard)
  @Permissions('transfer:cancel')
  @ApiOperation({ summary: 'Cancel transfer' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  cancel(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.transfer.cancel(orgId, id, reason || null, user.sub, req.requestId);
  }
}
