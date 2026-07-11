# Sprint 4.0 — CRM Lead Management (Production Foundation)

## Summary

Created a full CRM Lead Management module with 6 new Prisma models, complete REST API, timeline automation, organization isolation, RBAC permissions, audit logging, and 12 unit tests.

## Prisma Models Added

| Model | Table | Description |
|-------|-------|-------------|
| `Lead` | `leads` | Core lead with status/source/priority workflow, soft delete, archive |
| `LeadTag` | `lead_tags` | Tags on leads (name + color) |
| `LeadNote` | `lead_notes` | Notes with soft delete |
| `LeadActivity` | `lead_activities` | Activities: CALL, MEETING, TASK, EMAIL, REMINDER |
| `LeadTimeline` | `lead_timeline_entries` | Auto-recorded event log (append-only) |
| `LeadAssignmentHistory` | `lead_assignment_histories` | Track assignment changes |

**Enums added:** `LeadStatus`, `LeadSource`, `LeadPriority`, `ActivityType`

**Schema conventions followed:**
- UUID primary keys, snake_case via `@map`/`@@map`
- Soft delete with `deletedAt` + `deletedByUserId` + `deletedReason`
- Organization isolation via `organizationId` on `Lead`
- Proper indexes on all foreign keys and filtered columns
- Cascade deletes from Organization and Lead

## Files Created

| File | Purpose |
|------|---------|
| `src/crm/crm.module.ts` | Module importing Authorization + AuditLog |
| `src/crm/crm.controller.ts` | REST controller with 17 endpoints, RBAC + Swagger |
| `src/crm/crm.service.ts` | Full service with timeline automation, org isolation |
| `src/crm/dto/create-lead.dto.ts` | Validation: contactName required, enums, optional fields |
| `src/crm/dto/update-lead.dto.ts` | All fields optional, includes isArchived, assignedToId |
| `src/crm/dto/lead-query.dto.ts` | Search, filters (owner, assignee, status, source, priority, date range), pagination |
| `src/crm/dto/create-lead-note.dto.ts` | content required |
| `src/crm/dto/update-lead-note.dto.ts` | content required |
| `src/crm/dto/create-lead-activity.dto.ts` | type (enum), subject, optional description/dueAt/isCompleted |
| `src/crm/dto/assign-lead.dto.ts` | assignedToId required, optional reason |
| `src/crm/__tests__/crm.service.spec.ts` | 12 unit tests |

## Endpoints (17 total)

### Leads (9)
| Method | Route | Permissions |
|--------|-------|-------------|
| `POST` | `crm/organizations/:orgId/leads` | `lead:create` |
| `GET` | `crm/organizations/:orgId/leads` | `lead:read` |
| `GET` | `crm/organizations/:orgId/leads/:id` | `lead:read` |
| `PATCH` | `crm/organizations/:orgId/leads/:id` | `lead:update` |
| `POST` | `crm/organizations/:orgId/leads/:id/archive` | `lead:update` |
| `POST` | `crm/organizations/:orgId/leads/:id/restore` | `lead:update` |
| `DELETE` | `crm/organizations/:orgId/leads/:id` | `lead:delete` |
| `POST` | `crm/organizations/:orgId/leads/:id/assign` | `lead:assign` |

### Notes (4)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/leads/:leadId/notes` | `lead:read` |
| `POST` | `crm/organizations/:orgId/leads/:leadId/notes` | `lead:update` |
| `PATCH` | `crm/organizations/:orgId/leads/:leadId/notes/:noteId` | `lead:update` |
| `DELETE` | `crm/organizations/:orgId/leads/:leadId/notes/:noteId` | `lead:update` |

### Activities (2)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/leads/:leadId/activities` | `lead:read` |
| `POST` | `crm/organizations/:orgId/leads/:leadId/activities` | `lead:update` |

### Timeline (1)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/leads/:leadId/timeline` | `lead:read` |

### Assignment History (1)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/leads/:leadId/assignment-history` | `lead:read` |

## Security

- **Organization isolation**: All queries filter by `organizationId`
- **RBAC**: Existing `lead:*` permission group reused (`lead:create`, `lead:read`, `lead:update`, `lead:delete`, `lead:assign`)
- **Audit logging**: Every mutation creates an audit log entry
- **Soft delete**: All deletions are soft (nullified, not removed)
- **DTO validation**: `class-validator` decorators on all DTOs
- **Swagger**: `@ApiTags`, `@ApiOperation`, `@ApiProperty` on all endpoints

## Timeline Automation

The service automatically records timeline entries for:
- `lead.created` — when lead is created
- `lead.updated` — when lead details change
- `lead.status_changed` — when status transitions (with from/to)
- `lead.archived` / `lead.restored`
- `lead.assigned` — with from/to user info
- `note.added` — when note is created
- `activity.created` — when activity is created

## Search and Filtering

`GET /crm/organizations/:orgId/leads` supports:
- **Search**: contact name, company, email, phone (case-insensitive `contains`)
- **Filters**: ownerId, assignedToId, status, source, priority, createdAfter, createdBefore
- **Pagination**: page + limit defaults (20)
- **Sorting**: any field, direction (default `createdAt:desc`)

## Test Coverage (12 tests)

| Category | Tests |
|----------|-------|
| Leads | create, list, find one, not found, update status, archive, soft delete, assign |
| Notes | create with timeline |
| Activities | create with timeline |
| Timeline | paginated retrieval |
| Assignment History | history retrieval |

## Verification

```
npm run build      ✅
npm run lint       ✅
npm test           ✅ 30 suites, 376 tests
npx prisma validate ✅
```
