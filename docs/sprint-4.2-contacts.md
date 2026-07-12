# Sprint 4.2 — CRM Contact Management

## Overview

Complete Contact Management module for the CRM system, following the same architecture and conventions as the existing Lead and Company modules.

## Files Created / Modified

### Prisma Schema (`prisma/schema.prisma`)

- **New Enum:** `ContactStatus` — `ACTIVE`, `INACTIVE`
- **New Model:** `Contact` — Core contact entity with full CRM fields
- **New Model:** `ContactTimeline` — Immutable event log for contact changes
- **Updated:** `Organization` — added `contacts` relation
- **Updated:** `Company` — added `contacts` relation
- **Updated:** `User` — added `contactsOwned`, `contactsTimelineEntries` reverse relations

#### Contact Model Fields

| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| organizationId | String | Tenant isolation |
| companyId | String? | Optional Company relation (SetNull on delete) |
| ownerId | String | User who created/owns the contact |
| firstName | String | |
| lastName | String | |
| fullName | String | Computed: `firstName + lastName` |
| designation | String? | Job title |
| department | String? | Department name |
| email | String? | |
| phone | String? | |
| mobile | String? | |
| whatsapp | String? | |
| linkedin | String? | LinkedIn profile URL |
| website | String? | |
| birthday | DateTime? | |
| preferredLanguage | String? | |
| timezone | String | Default: `"UTC"` |
| status | ContactStatus | Default: `ACTIVE` |
| isPrimary | Boolean | Whether this is the primary contact for a company |
| isDecisionMaker | Boolean | Whether this contact is a decision maker |
| notes | String? | Free-text notes |
| avatar | String? | Avatar URL |
| isArchived | Boolean | Soft archive flag |
| deletedAt | DateTime? | Soft delete timestamp |
| deletedByUserId | String? | |
| deletedReason | String? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

#### Indexes

- `organizationId`, `companyId`, `email`, `fullName`, `status`, `isPrimary`, `isDecisionMaker`, `isArchived`, `deletedAt`, `createdAt`

### Module Structure (`src/contacts/`)

```
src/contacts/
  __tests__/
    contacts.service.spec.ts      # 14 tests (CRUD + RBAC + org isolation)
    contacts.controller.spec.ts   # 11 tests (all endpoints)
  dto/
    create-contact.dto.ts
    update-contact.dto.ts
    contact-query.dto.ts
    move-contact.dto.ts
  contacts.module.ts
  contacts.controller.ts
  contacts.service.ts
```

### Module Registration

Added `ContactsModule` to `src/app.module.ts` imports.

## API Endpoints

All endpoints are under `crm/organizations/:orgId/contacts` and require JWT + Permission guard.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/` | `contact:create` | Create a new contact |
| GET | `/` | `contact:read` | List contacts (search, filter, paginate) |
| GET | `/:id` | `contact:read` | Get contact details |
| PATCH | `/:id` | `contact:update` | Update contact |
| POST | `/:id/archive` | `contact:update` | Archive contact |
| POST | `/:id/restore` | `contact:update` | Restore from archive |
| DELETE | `/:id` | `contact:delete` | Soft delete contact |
| POST | `/:id/set-primary` | `contact:update` | Set as primary contact |
| POST | `/:id/set-decision-maker` | `contact:update` | Set as decision maker |
| POST | `/:id/move-company` | `contact:update` | Move to another company |
| GET | `/:contactId/timeline` | `contact:read` | Get contact timeline |

## Search

Searches across: `fullName`, `firstName`, `lastName`, `email`, `phone`, `mobile`, `designation`, `department` (case-insensitive `contains`).

## Filters

- `companyId`, `ownerId`, `isPrimary`, `isDecisionMaker`, `isArchived`, `status`, `createdAfter`, `createdBefore`

## Timeline Events

Automatically logged on `ContactTimeline`:

| Event | Trigger |
|-------|---------|
| `contact.created` | Contact creation |
| `contact.updated` | Contact update |
| `contact.archived` | Archive action |
| `contact.restored` | Restore action |
| `contact.primary_changed` | Set as primary |
| `contact.decision_maker_changed` | Set as decision maker |
| `contact.company_changed` | Move to another company |

## Security

- **Organization isolation:** Every query scoped by `organizationId`
- **RBAC:** `contact:create`, `contact:read`, `contact:update`, `contact:delete` permissions
- **Audit logging:** Every mutation creates an `AuditLog` entry with resource type `contact`
- **DTO validation:** `class-validator` decorators on all DTOs
- **Swagger:** `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiProperty[Optional]` decorators

## Tests

- **Service tests:** 14 tests covering create, findAll (with search/filter), findOne, update, archive, restore, delete, setPrimary, setDecisionMaker, moveCompany, getTimeline, and organization isolation (NotFoundException for wrong org)
- **Controller tests:** 11 tests verifying all endpoints call the correct service methods with the right parameters
- All 410 project tests pass (32 suites)

## Verification

```
npm run build          ✓
npm run lint           ✓
npx prisma validate    ✓
npm test               ✓ (410 tests, 32 suites)
```
