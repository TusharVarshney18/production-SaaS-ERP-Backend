# ERPX — Security Policy

> **Last Updated:** 2026-07-09  
> **Applies to:** All ERPX repositories and deployments

---

## 1. Security Policy

ERPX takes the security of its platform and customer data seriously. This document outlines the security policies, practices, and guidelines that all contributors and maintainers must follow.

### Scope

This policy covers:
- All source code in the ERPX repository
- All configuration files and documentation
- CI/CD pipelines and deployment scripts
- Development, staging, and production environments

---

## 2. Secret Management Rules

### 2.1 What Constitutes a Secret

Any value that, if exposed, could compromise the security of the system, including:

- Database connection strings
- JWT signing keys
- API keys for third-party services (Razorpay, Stripe, etc.)
- OAuth client IDs and client secrets
- Webhook signing secrets
- Encryption keys and salts
- SMTP credentials
- Cloud provider credentials
- Any password or passphrase
- Session secrets
- Internal service URLs and tokens

### 2.2 Rules

| Rule | Description |
|---|---|
| **Never commit secrets** | No secret value may be committed to the repository, in any branch, at any time. |
| **Use environment variables** | All secrets must be injected via environment variables at runtime. |
| **Use .env.example** | Check in a `.env.example` file with placeholder values only. Never commit the actual `.env` file. |
| **Validate on startup** | Applications must validate required environment variables at boot and fail fast if missing. |
| **No hardcoded defaults** | Never hardcode default secret values in source code. Empty strings or explicit errors are preferred. |
| **Key rotation** | All secrets must support rotation without code changes. |

### 2.3 What to Do If a Secret Is Committed

1. **Immediately** revoke the compromised secret (rotate keys, regenerate tokens)
2. Remove the secret from the repository history using `git filter-branch` or GitHub support
3. Audit logs and access patterns for unauthorized use
4. Document the incident internally

---

## 3. Environment Variable Policy

### 3.1 Required vs Optional

All environment variables must be clearly marked as **required** or **optional** in documentation.

- **Required:** Application will fail to start if not set
- **Optional:** Application uses a safe default or degrades gracefully

### 3.2 Naming Convention

```
<COMPONENT>_<PURPOSE>_<TYPE>
```

Examples:
- `RAZORPAY_KEY_ID` — component `RAZORPAY`, purpose `KEY`, type `ID`
- `JWT_ACCESS_SECRET` — component `JWT`, purpose `ACCESS`, type `SECRET`
- `DATABASE_URL` — component `DATABASE`, type `URL`

### 3.3 Documentation

When documenting environment variables:

- Document the **name** and **purpose** only
- Never document the **value**
- Use placeholder notation: `DATABASE_URL=<your_database_url>`

### 3.4 Validation

All environment variables must be validated at application startup using a validation schema (e.g., Joi). Validation should check:

- Presence (for required variables)
- Format (URL, hex string, minimum length)
- Allowed values (for enumerated settings like `NODE_ENV`)

---

## 4. Public Repository Guidelines

This repository may become public. To ensure it is safe for public access:

### 4.1 Documentation Rules

| ✅ Allowed | ❌ Not Allowed |
|---|---|
| Architecture descriptions | API keys or secrets |
| Module responsibilities | Database passwords |
| Technology stack | JWT signing keys |
| Environment variable **names** | Environment variable **values** |
| API endpoint paths | Production URLs or IPs |
| Database relationship diagrams | Connection strings |
| Design decisions and ADRs | Internal infrastructure details |
| Sprint progress and roadmap | Customer data or personal information |
| Public API design | Access tokens or session tokens |

### 4.2 Before Making a Repository Public

1. Run `git log --all -p` and search for common secret patterns
2. Use a secret scanner (e.g., GitLeaks, TruffleHog) across the full commit history
3. Verify `.gitignore` includes `.env`, `*.key`, `*.pem`, `secrets*`
4. Verify no commit history contains credentials
5. Remove or replace any sensitive data with placeholders
6. Notify team and rotate any potentially exposed secrets

### 4.3 Sensitive File Patterns

The following file patterns must never be committed:

```
.env
.env.local
.env.production
*.key
*.pem
*.cert
secrets*
credentials*
**/service-account.json
**/google-credentials.json
**/aws-credentials.json
```

---

## 5. Secure Development Checklist

### Before Committing Code

- [ ] No secrets, passwords, or credentials in the diff
- [ ] No hardcoded URLs pointing to internal infrastructure
- [ ] No `console.log()` statements that could leak data
- [ ] No commented-out code blocks containing secrets
- [ ] All environment variables accessed via ConfigService (NestJS) or equivalent
- [ ] All API endpoints have appropriate authentication guards
- [ ] All sensitive operations are logged via AuditLogService
- [ ] Input validation is applied (class-validator or Joi)
- [ ] No SQL injection vectors (use Prisma's parameterized queries)
- [ ] No mass assignment vulnerabilities (use DTOs with whitelisting)

### Before Merging a PR

- [ ] Code review completed by at least one other developer
- [ ] Security review for any authentication, authorization, or payment changes
- [ ] Dependencies checked for known vulnerabilities
- [ ] Tests pass (build, lint, test)
- [ ] No new secrets introduced

### Before Deployment

- [ ] All secrets configured in the deployment environment
- [ ] Environment validation passes on startup
- [ ] Database migrations reviewed and tested
- [ ] Rate limiting configured
- [ ] TLS enabled for all endpoints
- [ ] CORS configured appropriately for the deployment domain

---

## 6. Dependency Update Policy

### 6.1 Regular Updates

- **Patch updates:** Applied automatically via Dependabot or Renovate
- **Minor updates:** Reviewed and applied within 2 weeks
- **Major updates:** Reviewed, tested, and scheduled with proper migration planning

### 6.2 Security Vulnerabilities

- **Critical (CVSS 9.0+):** Update within 24 hours
- **High (CVSS 7.0–8.9):** Update within 7 days
- **Medium (CVSS 4.0–6.9):** Update within 30 days
- **Low (CVSS 0–3.9):** Update within the next regular release cycle

### 6.3 Review Process

1. Dependency update PRs are automatically created by Dependabot/Renovate
2. CI pipeline runs full test suite against the update
3. Changelog is reviewed for breaking changes
4. PR is merged if all checks pass and no breaking changes affect the platform
5. Breaking changes require manual review and migration planning

---

## 7. Reporting Security Issues

### 7.1 Responsible Disclosure

If you discover a security vulnerability in ERPX, please report it privately before disclosing it publicly.

### 7.2 How to Report

1. **Do not** open a public GitHub issue
2. **Do not** discuss the vulnerability in public forums, chat rooms, or social media
3. Send a detailed description of the vulnerability to the project maintainers via private communication channels
4. Include steps to reproduce, affected versions, and any potential impact

### 7.3 What to Include

- Type of vulnerability (XSS, SQL injection, authentication bypass, etc.)
- Steps to reproduce
- Affected versions and environments
- Any proof of concept (if available)
- Your contact information (optional)

### 7.4 Response Timeline

| Timeframe | Action |
|---|---|
| 24 hours | Acknowledgement of receipt |
| 72 hours | Initial assessment and triage |
| 7 days | Fix developed and tested |
| 14 days | Fix deployed (critical) or scheduled (medium/low) |
| 30 days | Public disclosure after fix is deployed |

### 7.5 Safe Harbor

When reporting security vulnerabilities according to this policy, we consider this:

- Authorized access to the system for testing purposes
- Waiver of any DMCA claims
- No legal action will be pursued against good-faith reporters

---

## 8. Compliance & Standards

ERPX follows industry-standard security practices:

- **OWASP Top 10** — All web application vulnerabilities are addressed
- **OWASP ASVS** — Application Security Verification Standard compliance
- **NIST 800-53** — Security controls framework alignment
- **GDPR** — Data protection principles (planned for production)
- **SOC 2** — Trust services criteria (planned for enterprise tier)

---

*This policy applies to all ERPX repositories, contributors, and deployments. Violations should be reported immediately to the security team.*
