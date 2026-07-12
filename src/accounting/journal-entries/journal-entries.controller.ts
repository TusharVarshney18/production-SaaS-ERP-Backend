import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../authorization/guards/permission.guard';
import { Permissions } from '../../authorization/decorators/permissions.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { JournalEntriesService } from './journal-entries.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { JournalEntryQueryDto } from './dto/journal-entry-query.dto';

@ApiTags('Accounting - Journal Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounting/organizations/:orgId/journal-entries')
export class JournalEntriesController {
  constructor(private readonly journalEntries: JournalEntriesService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions('journal_entry:create')
  @ApiOperation({ summary: 'Create a new journal entry' })
  create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateJournalEntryDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.journalEntries.create(orgId, dto, user.sub, req.requestId);
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions('journal_entry:read')
  @ApiOperation({ summary: 'List journal entries with filters and pagination' })
  findAll(@Param('orgId') orgId: string, @Query() query: JournalEntryQueryDto) {
    return this.journalEntries.findAll(orgId, query);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions('journal_entry:read')
  @ApiOperation({ summary: 'Get journal entry details with lines' })
  findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.journalEntries.findOne(orgId, id);
  }

  @Post(':id/post')
  @UseGuards(PermissionGuard)
  @Permissions('journal_entry:post')
  @ApiOperation({ summary: 'Post journal entry' })
  post(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.journalEntries.post(orgId, id, user.sub, req.requestId);
  }

  @Post(':id/reverse')
  @UseGuards(PermissionGuard)
  @Permissions('journal_entry:reverse')
  @ApiOperation({ summary: 'Reverse a posted journal entry' })
  @ApiBody({ schema: { type: 'object', properties: { reason: { type: 'string' } } } })
  reverse(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Req() req: { requestId: string },
  ) {
    return this.journalEntries.reverse(orgId, id, reason || null, user.sub, req.requestId);
  }
}
