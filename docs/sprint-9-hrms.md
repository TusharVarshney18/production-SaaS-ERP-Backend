# Sprint 9 — HRMS Foundation

## Overview

HRMS Foundation module providing employee management, attendance tracking, leave management, and payroll preparation interfaces.

## Module Structure

```
src/hrms/
├── hrms.module.ts                  # Root module
├── hooks/
│   └── payroll-hooks.interface.ts  # Future payroll integration interfaces
├── departments/
│   ├── departments.module.ts
│   ├── departments.controller.ts
│   ├── departments.service.ts      # CRUD
│   ├── dto/
│   │   ├── create-department.dto.ts
│   │   └── update-department.dto.ts
│   └── __tests__/
│       └── departments.service.spec.ts
├── designations/
│   ├── designations.module.ts
│   ├── designations.controller.ts
│   ├── designations.service.ts     # CRUD by level
│   ├── dto/
│   │   ├── create-designation.dto.ts
│   │   └── update-designation.dto.ts
│   └── __tests__/
│       └── designations.service.spec.ts
├── employees/
│   ├── employees.module.ts
│   ├── employees.controller.ts
│   ├── employees.service.ts        # CRUD, search, hierarchy
│   ├── dto/
│   │   ├── create-employee.dto.ts
│   │   ├── update-employee.dto.ts
│   │   └── employee-query.dto.ts
│   └── __tests__/
│       └── employees.service.spec.ts
├── attendance/
│   ├── attendance.module.ts
│   ├── attendance.controller.ts
│   ├── attendance.service.ts       # Check-in, check-out, history
│   ├── dto/
│   │   ├── check-in.dto.ts
│   │   ├── check-out.dto.ts
│   │   └── attendance-query.dto.ts
│   └── __tests__/
│       └── attendance.service.spec.ts
└── leave/
    ├── leave.module.ts
    ├── leave.controller.ts
    ├── leave.service.ts            # Apply, approve, reject
    ├── dto/
    │   ├── apply-leave.dto.ts
    │   └── leave-query.dto.ts
    └── __tests__/
        └── leave.service.spec.ts
```

## Prisma Models

### Department
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | |
| name | String | Unique per org |
| code | String | Unique per org |
| description | String? | |
| isActive | Boolean | |

### Designation
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | |
| name | String | Unique per org |
| code | String | Unique per org |
| level | Int | 0-based hierarchy level |
| isActive | Boolean | |

### Employee
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| organizationId | UUID | |
| employeeCode | String | Unique per org |
| firstName / lastName | String | |
| email | String? | Unique per org |
| phone | String? | |
| departmentId | UUID? | FK |
| designationId | UUID? | FK |
| joiningDate | DateTime? | |
| employmentStatus | Enum | ACTIVE, INACTIVE, TERMINATED |
| managerId | UUID? | Self-referencing hierarchy |
| metadata | Json? | Extensible fields |

### Attendance
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| employeeId | UUID | FK |
| date | DateTime | Unique per employee |
| checkIn / checkOut | DateTime? | |
| status | Enum | PRESENT, ABSENT, HALF_DAY, LEAVE |

### LeaveRequest
| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| employeeId | UUID | FK |
| leaveType | Enum | CASUAL, SICK, ANNUAL, UNPAID |
| startDate / endDate | DateTime | |
| reason | String? | |
| status | Enum | PENDING → APPROVED / REJECTED |
| approvedBy / rejectedBy | String? | User IDs |

## Business Logic

### Departments & Designations
- Standard CRUD with unique code/name per org
- Listed with employee counts

### Employees
- **Create**: Validates unique employeeCode and email; validates department/designation exist
- **Search**: By firstName, lastName, employeeCode, email
- **Filters**: employmentStatus, departmentId, designationId
- **Hierarchy**: Self-referencing manager → subordinates

### Attendance
- **Check-in**: Creates today's record with PRESENT status; prevents duplicate check-in
- **Check-out**: Updates today's record with check-out time; requires prior check-in
- **History**: Paginated, filterable by employee, status, date range

### Leave
- **Apply**: Validates employee, date range, checks for overlaps with PENDING/APPROVED leaves
- **Approve**: PENDING → APPROVED
- **Reject**: PENDING → REJECTED (with reason)

## Payroll Hooks (Interfaces Only)

Prepared interfaces for future payroll implementation:

| Interface | Purpose |
|---|---|
| `SalaryStructure` | Basic salary, allowances, deductions |
| `PayrollInput` | Employee data + attendance + period |
| `IPayrollHooksService` | `calculateSalary()`, `processPayroll()` |
| `HolidayCalendar` | Holiday definitions |
| `IHolidayCalendarService` | Holiday lookup methods |

## Security

- **Organization Isolation**: All queries scoped to `organizationId`
- **RBAC**:
  - `department:create/read/update`
  - `designation:create/read/update`
  - `employee:create/read/update`
  - `attendance:create/read`
  - `leave:create/read/approve/reject`
- **Audit Logging**: Every mutation records audit log
- **Swagger**: All endpoints documented

## Test Coverage

| Module | Tests | Status |
|---|---|---|
| Departments | 3 (create, duplicate, findOne, org isolation) | ✅ |
| Designations | 2 (create, findOne, org isolation) | ✅ |
| Employees | 4 (create, duplicate code, findAll, findOne, org isolation) | ✅ |
| Attendance | 6 (check-in, already checked-in, invalid employee, check-out, no check-in, org isolation) | ✅ |
| Leave | 6 (apply, overlapping, approve, reject, org isolation) | ✅ |
| **Total** | **23 tests** | ✅ |

## Verification

| Check | Result |
|---|---|
| `npm run build` | ✅ Passes |
| `npm run lint` | ✅ Clean |
| `npm test` | ✅ **753/753 pass** (23 HRMS tests) |
| `npx prisma validate` | ✅ Valid |
| `docs/sprint-9-hrms.md` | ✅ Generated |

## Architecture Decisions

1. **Self-referencing employee hierarchy**: Manager-subordinate relationship uses a self-referencing `managerId` on Employee, avoiding a separate org chart model.
2. **Attendance per day**: Single record per employee per day with check-in/check-out timestamps. Status auto-set to PRESENT on check-in.
3. **Leave overlap prevention**: Only PENDING and APPROVED leaves are checked for date overlaps, allowing rejected leaves to be re-applied.
4. **Employee metadata as JSON**: Extensible `metadata` field allows storing additional employee info (emergency contact, bank details, etc.) without schema changes.
5. **Designation levels**: Numeric `level` field enables sorting and hierarchy queries (e.g., employees with level > 3).
6. **Payroll hooks prepared**: Interfaces defined for salary calculation, payroll processing, and holiday calendar — no implementation yet, as per scope.
