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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../authorization/guards/permission.guard';
import { Permissions } from '../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { ContactQueryDto } from './dto/contact-query.dto';
import { MoveContactDto } from './dto/move-contact.dto';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm/organizations/:orgId/contacts')
export class ContactsController {
  constructor(private readonly contacts: ContactsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('contact:create')
  @ApiOperation({ summary: 'Create a new contact' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateContactDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('contact:read')
  @ApiOperation({ summary: 'List contacts with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: ContactQueryDto) {
    return this.contacts.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('contact:read')
  @ApiOperation({ summary: 'Get contact details with company and timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.contacts.findOne(orgId, id);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions('contact:update')
  @ApiOperation({ summary: 'Update contact' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post(':id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('contact:update')
  @ApiOperation({ summary: 'Archive contact' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.archive(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('contact:update')
  @ApiOperation({ summary: 'Restore contact from archive' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions('contact:delete')
  @ApiOperation({ summary: 'Soft delete contact' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.delete(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/set-primary')
  @UseGuards(PermissionGuard)
  @Permissions('contact:update')
  @ApiOperation({ summary: 'Set contact as primary contact' })
  setPrimary(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.setPrimary(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/set-decision-maker')
  @UseGuards(PermissionGuard)
  @Permissions('contact:update')
  @ApiOperation({ summary: 'Set contact as decision maker' })
  setDecisionMaker(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.setDecisionMaker(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/move-company')
  @UseGuards(PermissionGuard)
  @Permissions('contact:update')
  @ApiOperation({ summary: 'Move contact to another company' })
  moveCompany(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: MoveContactDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.contacts.moveCompany(orgId, id, dto, user.sub, req.requestId);
  }

  @Get(':contactId/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('contact:read')
  @ApiOperation({ summary: 'Get contact timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('contactId') contactId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.contacts.getTimeline(orgId, contactId, page, limit);
  }
}
