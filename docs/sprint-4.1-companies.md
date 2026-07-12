# Sprint 4.1 — CRM Company Management (Production)

## Summary

Extended the CRM module with full Company management: `Company` model with 30+ fields, Lead-Company relationship, Notes, Activities, Timeline, RBAC permissions, and 9 new endpoints.

## Prisma Models Added

| Model | Table | Description |
|-------|-------|-------------|
| `Company` | `companies` | Core company with 30+ fields (name, legal, tax, addresses, industry, etc.), soft delete, archive |
| `CompanyNote` | `company_notes` | Notes on companies with soft delete |
| `CompanyActivity` | `company_activities` | Activities: CALL, MEETING, TASK, EMAIL, REMINDER |
| `CompanyTimeline` | `company_timeline_entries` | Auto-recorded event log (append-only) |

## Existing Models Modified

| Model | Change |
|-------|--------|
| `Lead` | Added optional `companyId` + `company` relation (many-to-one) |
| `Organization` | Added `companies` reverse relation |
| `User` | Added `companiesOwned`, `companyNotes`, `companyActivities`, `companyTimelineEntries` |

## Schema Conventions Followed

- UUID primary keys, snake_case via `@map`/`@@map`
- Soft delete with `deletedAt` + `deletedByUserId` + `deletedReason`
- Organization isolation via `organizationId`
- Proper indexes on all foreign keys and filtered columns
- Cascade deletes from Organization and Company
- All lead/CMM conventions replicated for company entities

## Permissions Added (seed.ts)

```
company:create — Create companies
company:read   — View companies
company:update — Update companies
company:delete — Delete companies
company:*      — Full access to companies
```

Manager role template updated: `company:*` added.

## DTOs Created

| DTO | Description |
|-----|-------------|
| `CreateCompanyDto` | name required, 20+ optional fields with validation |
| `UpdateCompanyDto` | All fields optional, includes `isArchived` |
| `CompanyQueryDto` | Search, filters (industry, owner, customer, vendor, archived, country), pagination |

## Endpoints Added (9)

### Companies (7)
| Method | Route | Permissions |
|--------|-------|-------------|
| `POST` | `crm/organizations/:orgId/companies` | `company:create` |
| `GET` | `crm/organizations/:orgId/companies` | `company:read` |
| `GET` | `crm/organizations/:orgId/companies/:id` | `company:read` |
| `PATCH` | `crm/organizations/:orgId/companies/:id` | `company:update` |
| `POST` | `crm/organizations/:orgId/companies/:id/archive` | `company:update` |
| `POST` | `crm/organizations/:orgId/companies/:id/restore` | `company:update` |
| `DELETE` | `crm/organizations/:orgId/companies/:id` | `company:delete` |

### Notes (2)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/companies/:companyId/notes` | `company:read` |
| `POST` | `crm/organizations/:orgId/companies/:companyId/notes` | `company:update` |

### Activities (2)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/companies/:companyId/activities` | `company:read` |
| `POST` | `crm/organizations/:orgId/companies/:companyId/activities` | `company:update` |

### Timeline (1)
| Method | Route | Permissions |
|--------|-------|-------------|
| `GET` | `crm/organizations/:orgId/companies/:companyId/timeline` | `company:read` |

## Lead-Company Relationship

The `Lead` model now has an optional `companyId` foreign key. When viewing company details, associated leads are included (up to 20 most recent). The relationship is set via the `companyId` field on `CreateLeadDto`/`UpdateLeadDto`.

## Timeline Events (Auto-Recorded)

- `company.created`
- `company.updated`
- `company.archived`
- `company.restored`
- `note.added`
- `activity.created`

## Search and Filtering

`GET /crm/organizations/:orgId/companies` supports:
- **Search**: name, legal name, email, phone (case-insensitive `contains`)
- **Filters**: industry, ownerId, isCustomer, isVendor, isArchived, country
- **Pagination**: page + limit defaults (20)
- **Sorting**: any field, direction (default `createdAt:desc`)

## Security

- Organization isolation via `organizationId` on all queries
- RBAC via `@Permissions('company:*')` decorators
- Audit logging on all mutations via `AuditLogService`
- Soft delete (nullified, not removed)
- `class-validator` DTO validation
- Swagger decorators on all endpoints

## Verification

```
npm run build      ✅
npm run lint       ✅
npm test           ✅ 30 suites, 385 tests
npx prisma validate ✅
```
