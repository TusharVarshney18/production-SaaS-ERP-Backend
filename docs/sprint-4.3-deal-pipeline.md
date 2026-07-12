# Sprint 4.3 – CRM Deal Pipeline

## Overview

Deal Pipeline management module for the ERPX CRM system. Manages pipelines, custom stages, deals, and deal-level actions (move stage, change owner, mark won/lost). Provides automated timeline logging, audit trails, and dashboard statistics.

## Architecture

- **Module**: `DealsModule` in `src/deals/`
- **Controller**: `DealsController` — routes under `/api/v1/crm/organizations/:orgId`
- **Service**: `DealsService` — business logic with org isolation
- **Database**: `Pipeline`, `PipelineStage`, `Deal`, `DealTimeline` models in Prisma schema

## Prisma Models

### Pipeline
```prisma
model Pipeline {
  id             String
  organizationId String
  name           String
  isDefault      Boolean
  displayOrder   Int
  isArchived     Boolean
  stages         PipelineStage[]
  deals          Deal[]
}
```

### PipelineStage
```prisma
model PipelineStage {
  id           String
  pipelineId   String
  name         String
  probability  Int
  displayOrder Int
  color        String
  isWon        Boolean
  isLost       Boolean
  deals        Deal[]
}
```

### Deal
```prisma
model Deal {
  id               String
  organizationId   String
  pipelineId       String
  stageId          String
  companyId        String?
  primaryContactId String?
  leadId           String?
  ownerId          String
  title            String
  description      String?
  value            Int
  currency         String
  probability      Int
  expectedCloseDate DateTime?
  actualCloseDate  DateTime?
  status           DealStatus (OPEN | WON | LOST | ARCHIVED)
  lossReason       String?
  wonReason        String?
  isArchived       Boolean
  deletedAt        DateTime?
  timeline         DealTimeline[]
}
```

## APIs

### Pipelines

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/pipelines` | `pipeline:create` | Create pipeline |
| GET | `/pipelines` | `pipeline:read` | List pipelines |
| GET | `/pipelines/:id` | `pipeline:read` | Get pipeline with stages |
| PATCH | `/pipelines/:id` | `pipeline:update` | Update pipeline |
| POST | `/pipelines/:id/archive` | `pipeline:update` | Archive pipeline |
| POST | `/pipelines/:id/restore` | `pipeline:update` | Restore pipeline |
| DELETE | `/pipelines/:id` | `pipeline:delete` | Delete pipeline (hard) |

### Stages

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/pipelines/:pipelineId/stages` | `pipeline:update` | Create stage |
| PATCH | `/pipelines/:pipelineId/stages/:stageId` | `pipeline:update` | Update stage |
| POST | `/pipelines/:pipelineId/stages/reorder` | `pipeline:update` | Reorder stages |
| DELETE | `/pipelines/:pipelineId/stages/:stageId` | `pipeline:delete` | Delete stage (hard) |

### Deals

| Method | Endpoint | Permission | Description |
|--------|----------|------------|-------------|
| POST | `/deals` | `deal:create` | Create deal |
| GET | `/deals` | `deal:read` | List deals |
| GET | `/deals/stats` | `deal:read` | Dashboard statistics |
| GET | `/deals/:id` | `deal:read` | Get deal details |
| PATCH | `/deals/:id` | `deal:update` | Update deal |
| POST | `/deals/:id/move-stage` | `deal:update` | Move to another stage |
| POST | `/deals/:id/change-owner` | `deal:update` | Change owner |
| POST | `/deals/:id/mark-won` | `deal:update` | Mark as won |
| POST | `/deals/:id/mark-lost` | `deal:update` | Mark as lost |
| POST | `/deals/:id/archive` | `deal:update` | Archive deal |
| POST | `/deals/:id/restore` | `deal:update` | Restore from archive |
| DELETE | `/deals/:id` | `deal:delete` | Soft delete deal |
| GET | `/deals/:id/timeline` | `deal:read` | Get deal timeline |

## Search

Searches across: `title`

## Filters

- `search` — title search
- `pipelineId` — filter by pipeline
- `stageId` — filter by stage
- `ownerId` — filter by owner
- `status` — OPEN / WON / LOST / ARCHIVED
- `minValue` / `maxValue` — value range
- `expectedCloseAfter` / `expectedCloseBefore` — close date range
- `createdAfter` / `createdBefore` — created date range
- `page`, `limit`, `sortBy`, `sortOrder` — pagination and sorting

## Timeline Events

Automatically logged on `DealTimeline`:

- `deal.created`
- `deal.updated`
- `deal.stage_changed`
- `deal.owner_changed`
- `deal.value_changed`
- `deal.won`
- `deal.lost`
- `deal.archived`
- `deal.restored`

## Dashboard Statistics

`GET /deals/stats` returns:
- `openDeals` — count of open deals
- `wonDeals` — count of won deals
- `lostDeals` — count of lost deals
- `pipelineValue` — sum of non-lost deal values
- `winRate` — percentage of won/(won+lost)
- `averageDealValue` — average value of won deals

## Security

- **Organization isolation**: All queries scoped by `organizationId`
- **RBAC**: Permission guards with `pipeline:*` and `deal:*` permissions
- **Audit logging**: All mutations logged via `AuditLogService`
- **DTO validation**: All inputs validated with `class-validator`
- **Swagger**: Full API documentation via `@nestjs/swagger` decorators

## Permissions (seed.ts)

```typescript
{ group: 'crm', resource: 'pipeline', actions: [create, read, update, delete, *] },
{ group: 'crm', resource: 'deal', actions: [create, read, update, delete, *] },
```

## Files

| File | Description |
|------|-------------|
| `prisma/schema.prisma` | Pipeline, PipelineStage, Deal, DealTimeline models |
| `prisma/seed.ts` | Deal/pipeline permissions |
| `src/deals/deals.module.ts` | Module definition |
| `src/deals/deals.controller.ts` | REST controller (30 endpoints) |
| `src/deals/deals.service.ts` | Business logic |
| `src/deals/dto/` | 12 DTOs (create/update/query/actions) |
| `src/deals/__tests__/deals.service.spec.ts` | Service tests |
| `src/deals/__tests__/deals.controller.spec.ts` | Controller tests |
| `src/app.module.ts` | Module registration |

## Tests

- **Service tests**: 21 tests covering pipelines, stages, deals CRUD, move stage, change owner, mark won/lost, archive, restore, delete, dashboard stats, org isolation
- **Controller tests**: 15 tests verifying all endpoint delegations

## Dependencies

Reuses existing:
- `AuthorizationModule` (PermissionGuard)
- `AuditLogModule` (AuditLogService)
- `PrismaModule` (PrismaService)
