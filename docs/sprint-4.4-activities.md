# Sprint 4.4 – CRM Activity & Task Engine

## Overview

Shared Activity & Task Engine for the ERPX CRM system. Provides a unified, polymorphic activity model that can be associated with any entity (Lead, Company, Contact, Deal). Supports tasks with status, priority, assignment, due dates, and automated timeline logging.

## Architecture

- **Module**: `ActivitiesModule` in `src/activities/`
- **Controller**: `ActivitiesController` — routes under `/api/v1/crm/organizations/:orgId/activities`
- **Service**: `ActivitiesService` — business logic with org isolation
- **Database**: `Activity` + `ActivityTimeline` models in Prisma schema

## Polymorphic Entity Support

Activities use a polymorphic pattern (`entityType` + `entityId`) to associate with any CRM entity:

```
Activity {
  entityType: "lead" | "company" | "contact" | "deal"
  entityId:   <UUID of the entity>
}
```

Future modules can reuse this by simply specifying their entity type string.

## Prisma Models

### Activity
```prisma
model Activity {
  id             String
  organizationId String
  entityType     String        // polymorphic: "lead", "company", "contact", "deal"
  entityId       String
  ownerId        String
  assignedToId   String?
  type           ActivityType  // CALL | MEETING | TASK | EMAIL | REMINDER | NOTE | FOLLOW_UP
  title          String
  description    String?
  status         ActivityStatus  // PENDING | IN_PROGRESS | COMPLETED | CANCELLED
  priority       ActivityPriority // LOW | MEDIUM | HIGH | URGENT
  dueDate        DateTime?
  completedAt    DateTime?
  isArchived     Boolean
  deletedAt      DateTime?
  timeline       ActivityTimeline[]
}
```

## APIs

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/activities` | `activity:create` | Create activity |
| GET | `/activities` | `activity:read` | List activities |
| GET | `/activities/:id` | `activity:read` | Get activity details |
| PATCH | `/activities/:id` | `activity:update` | Update activity |
| POST | `/activities/:id/complete` | `activity:update` | Mark completed |
| POST | `/activities/:id/cancel` | `activity:update` | Cancel activity |
| POST | `/activities/:id/archive` | `activity:update` | Archive activity |
| POST | `/activities/:id/restore` | `activity:update` | Restore from archive |
| DELETE | `/activities/:id` | `activity:delete` | Soft delete activity |
| POST | `/activities/:id/assign` | `activity:update` | Assign to user |
| POST | `/activities/:id/change-due-date` | `activity:update` | Change due date |
| POST | `/activities/:id/change-priority` | `activity:update` | Change priority |
| GET | `/activities/:id/timeline` | `activity:read` | Get activity timeline |

## Search

Searches across: `title`, `description`

## Filters

- `search` — title/description search
- `entityType` — filter by entity type
- `entityId` — filter by entity ID
- `ownerId` — filter by owner
- `assignedToId` — filter by assignee
- `type` — CALL / MEETING / TASK / EMAIL / REMINDER / NOTE / FOLLOW_UP
- `status` — PENDING / IN_PROGRESS / COMPLETED / CANCELLED
- `priority` — LOW / MEDIUM / HIGH / URGENT
- `isArchived` — archived status
- `dueDateAfter` / `dueDateBefore` — due date range
- `createdAfter` / `createdBefore` — created date range
- `page`, `limit`, `sortBy`, `sortOrder` — pagination and sorting

## Timeline Events

Automatically logged on `ActivityTimeline`:

- `activity.created`
- `activity.updated`
- `activity.assigned`
- `activity.completed`
- `activity.cancelled`
- `activity.due_date_changed`
- `activity.priority_changed`
- `activity.archived`
- `activity.restored`

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Permission guard with `activity:create`, `activity:read`, `activity:update`, `activity:delete`, `activity:*`
- **Audit logging**: All mutations logged via `AuditLogService`
- **DTO validation**: All inputs validated with `class-validator`
- **Swagger**: Full API documentation via `@nestjs/swagger` decorators

## Permissions (seed.ts)

```typescript
{ groupSlug: 'crm', resource: 'activity', action: 'create' },
{ groupSlug: 'crm', resource: 'activity', action: 'read' },
{ groupSlug: 'crm', resource: 'activity', action: 'update' },
{ groupSlug: 'crm', resource: 'activity', action: 'delete' },
{ groupSlug: 'crm', resource: 'activity', action: '*' },
```

## Files

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | Activity, ActivityTimeline models + ActivityStatus, ActivityPriority enums |
| `prisma/seed.ts` | Activity permissions |
| `src/activities/activities.module.ts` | Module definition |
| `src/activities/activities.controller.ts` | REST controller (13 endpoints) |
| `src/activities/activities.service.ts` | Business logic |
| `src/activities/dto/create-activity.dto.ts` | Create DTO |
| `src/activities/dto/update-activity.dto.ts` | Update DTO |
| `src/activities/dto/activity-query.dto.ts` | Query/filter DTO |
| `src/activities/dto/assign-activity.dto.ts` | Assign DTO |
| `src/activities/dto/change-due-date.dto.ts` | Due date DTO |
| `src/activities/dto/change-priority.dto.ts` | Priority DTO |
| `src/activities/__tests__/activities.service.spec.ts` | Service tests |
| `src/activities/__tests__/activities.controller.spec.ts` | Controller tests |
| `src/app.module.ts` | Module registration |

## Tests

- **Service tests**: 17 tests — create, findAll (with entity filter), findOne, update, complete, cancel, archive, restore, delete, assign, changeDueDate, changePriority, getTimeline, org isolation
- **Controller tests**: 12 tests — all endpoint delegations verified

## Reusability

This Activity engine replaces the need for entity-specific activity tables. To use with a new entity:

1. Call `POST /activities` with `entityType: "your-entity"` and `entityId: "<id>"`
2. Query with `?entityType=your-entity&entityId=<id>`

No schema changes or new modules required for future entities.
