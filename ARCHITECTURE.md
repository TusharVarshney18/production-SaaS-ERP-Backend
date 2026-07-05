# ERPX Backend Architecture

## Overview

ERPX is a multi-tenant SaaS ERP backend built with NestJS, PostgreSQL, and Prisma.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** NestJS 10
- **Database:** PostgreSQL 16 via Prisma 5
- **ORM:** Prisma (with migrations)
- **Auth:** Passport + JWT (access + refresh token rotation)
- **Validation:** class-validator + Joi (env schema)
- **API:** RESTful with Swagger docs
- **Logging:** Pino (structured JSON logging)
- **Security:** Helmet, CORS, Throttling, Argon2 password hashing
- **Testing:** Jest (unit + e2e)

## Project Structure

```
src/
├── auth/          # Authentication module (register, login, logout, refresh, me)
├── common/        # Shared middleware, filters, interceptors
├── config/        # Configuration (env vars, Joi schema)
├── health/        # Health check endpoints
└── prisma/        # Prisma service (singleton, DI)
```

## Key Design Decisions

### Multi-tenancy
Row-level tenant isolation via `organizationId` on all tenant-scoped models.

### Authentication
- JWT access + refresh token pattern with rotation
- Refresh token rotation prevents token replay attacks
- Session management with revocation support

### Permissions
System-wide permission groups and permissions, assigned per-role per-organization.

## API Versioning

URI-based versioning with default version `v1`. Health/ready endpoints are version-neutral.

## Scripts

- `npm run build` - Compile TypeScript
- `npm run start:dev` - Watch mode development
- `npm run lint` - ESLint with autofix
- `npm run test` - Unit tests
- `npm run test:e2e` - End-to-end tests
- `npm run prisma:seed` - Seed permission groups and permissions
