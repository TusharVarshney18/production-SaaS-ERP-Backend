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
import { CrmService } from './crm.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadQueryDto } from './dto/lead-query.dto';
import { CreateLeadNoteDto } from './dto/create-lead-note.dto';
import { UpdateLeadNoteDto } from './dto/update-lead-note.dto';
import { CreateLeadActivityDto } from './dto/create-lead-activity.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CompanyQueryDto } from './dto/company-query.dto';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('crm/organizations/:orgId')
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  // ─── Leads ──────────────────────────────

  @Post('leads')
  @UseGuards(PermissionGuard)
  @Permissions('lead:create')
  @ApiOperation({ summary: 'Create a new lead' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateLeadDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.create(orgId, dto, user.sub, req.requestId);
  }

  @Get('leads')
  @UseGuards(PermissionGuard)
  @Permissions('lead:read')
  @ApiOperation({ summary: 'List leads with search, filter, pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: LeadQueryDto) {
    return this.crm.findAll(orgId, query);
  }

  @Get('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions('lead:read')
  @ApiOperation({ summary: 'Get lead details with notes, activities, timeline' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.crm.findOne(orgId, id);
  }

  @Patch('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Update lead' })
  update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.update(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('leads/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Archive lead' })
  archive(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.archive(orgId, id, user.sub, req.requestId);
  }

  @Post('leads/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Restore lead from archive' })
  restore(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.restore(orgId, id, user.sub, req.requestId);
  }

  @Delete('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions('lead:delete')
  @ApiOperation({ summary: 'Soft delete lead' })
  delete(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.delete(orgId, id, user.sub, req.requestId);
  }

  @Post('leads/:id/assign')
  @UseGuards(PermissionGuard)
  @Permissions('lead:assign')
  @ApiOperation({ summary: 'Assign lead to user' })
  assign(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.assign(orgId, id, dto, user.sub, req.requestId);
  }

  // ─── Notes ──────────────────────────────

  @Get('leads/:leadId/notes')
  @UseGuards(PermissionGuard)
  @Permissions('lead:read')
  @ApiOperation({ summary: 'List notes for a lead' })
  listNotes(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.crm.listNotes(orgId, leadId, page, limit);
  }

  @Post('leads/:leadId/notes')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Add note to lead' })
  createNote(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Body() dto: CreateLeadNoteDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.createNote(orgId, leadId, dto, user.sub, req.requestId);
  }

  @Patch('leads/:leadId/notes/:noteId')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Edit note' })
  updateNote(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Param('noteId') noteId: string,
    @Body() dto: UpdateLeadNoteDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.updateNote(orgId, leadId, noteId, dto, user.sub, req.requestId);
  }

  @Delete('leads/:leadId/notes/:noteId')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Delete note' })
  deleteNote(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.deleteNote(orgId, leadId, noteId, user.sub, req.requestId);
  }

  // ─── Activities ─────────────────────────

  @Get('leads/:leadId/activities')
  @UseGuards(PermissionGuard)
  @Permissions('lead:read')
  @ApiOperation({ summary: 'List activities for a lead' })
  listActivities(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.crm.listActivities(orgId, leadId, page, limit);
  }

  @Post('leads/:leadId/activities')
  @UseGuards(PermissionGuard)
  @Permissions('lead:update')
  @ApiOperation({ summary: 'Create activity (call, meeting, task, email, reminder)' })
  createActivity(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Body() dto: CreateLeadActivityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.createActivity(orgId, leadId, dto, user.sub, req.requestId);
  }

  // ─── Timeline ───────────────────────────

  @Get('leads/:leadId/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('lead:read')
  @ApiOperation({ summary: 'Get lead timeline' })
  getTimeline(
    @Param('orgId') orgId: string,
    @Param('leadId') leadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.crm.getTimeline(orgId, leadId, page, limit);
  }

  // ─── Assignment History ─────────────────

  @Get('leads/:leadId/assignment-history')
  @UseGuards(PermissionGuard)
  @Permissions('lead:read')
  @ApiOperation({ summary: 'Get lead assignment history' })
  getAssignmentHistory(@Param('orgId') orgId: string, @Param('leadId') leadId: string) {
    return this.crm.getAssignmentHistory(orgId, leadId);
  }

  // ─── Companies ───────────────────────────

  @Post('companies')
  @UseGuards(PermissionGuard)
  @Permissions('company:create')
  @ApiOperation({ summary: 'Create a new company' })
  createCompany(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.createCompany(orgId, dto, user.sub, req.requestId);
  }

  @Get('companies')
  @UseGuards(PermissionGuard)
  @Permissions('company:read')
  @ApiOperation({ summary: 'List companies with search, filter, pagination' })
  findAllCompanies(@Param('orgId') orgId: string, @Query() query: CompanyQueryDto) {
    return this.crm.findAllCompanies(orgId, query);
  }

  @Get('companies/:id')
  @UseGuards(PermissionGuard)
  @Permissions('company:read')
  @ApiOperation({ summary: 'Get company details with leads, notes, activities, timeline' })
  findOneCompany(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.crm.findOneCompany(orgId, id);
  }

  @Patch('companies/:id')
  @UseGuards(PermissionGuard)
  @Permissions('company:update')
  @ApiOperation({ summary: 'Update company' })
  updateCompany(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.updateCompany(orgId, id, dto, user.sub, req.requestId);
  }

  @Post('companies/:id/archive')
  @UseGuards(PermissionGuard)
  @Permissions('company:update')
  @ApiOperation({ summary: 'Archive company' })
  archiveCompany(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.archiveCompany(orgId, id, user.sub, req.requestId);
  }

  @Post('companies/:id/restore')
  @UseGuards(PermissionGuard)
  @Permissions('company:update')
  @ApiOperation({ summary: 'Restore company from archive' })
  restoreCompany(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.restoreCompany(orgId, id, user.sub, req.requestId);
  }

  @Delete('companies/:id')
  @UseGuards(PermissionGuard)
  @Permissions('company:delete')
  @ApiOperation({ summary: 'Soft delete company' })
  deleteCompany(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.deleteCompany(orgId, id, user.sub, req.requestId);
  }

  // ─── Company Notes ───────────────────────

  @Get('companies/:companyId/notes')
  @UseGuards(PermissionGuard)
  @Permissions('company:read')
  @ApiOperation({ summary: 'List company notes' })
  listCompanyNotes(
    @Param('orgId') orgId: string,
    @Param('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.crm.listCompanyNotes(orgId, companyId, page, limit);
  }

  @Post('companies/:companyId/notes')
  @UseGuards(PermissionGuard)
  @Permissions('company:update')
  @ApiOperation({ summary: 'Add note to company' })
  createCompanyNote(
    @Param('orgId') orgId: string,
    @Param('companyId') companyId: string,
    @Body('content') content: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.createCompanyNote(orgId, companyId, content, user.sub, req.requestId);
  }

  // ─── Company Activities ─────────────────

  @Get('companies/:companyId/activities')
  @UseGuards(PermissionGuard)
  @Permissions('company:read')
  @ApiOperation({ summary: 'List company activities' })
  listCompanyActivities(
    @Param('orgId') orgId: string,
    @Param('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.crm.listCompanyActivities(orgId, companyId, page, limit);
  }

  @Post('companies/:companyId/activities')
  @UseGuards(PermissionGuard)
  @Permissions('company:update')
  @ApiOperation({ summary: 'Create activity on company' })
  createCompanyActivity(
    @Param('orgId') orgId: string,
    @Param('companyId') companyId: string,
    @Body() dto: CreateLeadActivityDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.crm.createCompanyActivity(orgId, companyId, dto, user.sub, req.requestId);
  }

  // ─── Company Timeline ────────────────────

  @Get('companies/:companyId/timeline')
  @UseGuards(PermissionGuard)
  @Permissions('company:read')
  @ApiOperation({ summary: 'Get company timeline' })
  getCompanyTimeline(
    @Param('orgId') orgId: string,
    @Param('companyId') companyId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.crm.getCompanyTimeline(orgId, companyId, page, limit);
  }
}
