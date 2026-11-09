# Focused security review — Prompt 4

Scope: the database access layer, tenant helpers, event lifecycle, registration
integrity, club/role administration, audit logging, authentication, sessions,
password recovery, RBAC, CSRF/origin checks, PostgreSQL-backed rate limiting,
test-database safety, seed safety, and the current landing/auth UI surface.
Dashboards, public business APIs, uploads, OCR, and deployment remain out of
scope.

Review date: 2026-11-09.

## Result summary

| Severity      | Findings                                | Status                             |
| ------------- | --------------------------------------- | ---------------------------------- |
| Critical      | 0                                       | None found                         |
| High          | 0 within the implemented Prompt 4 scope | None found                         |
| Medium        | 3                                       | Documented/accepted for this phase |
| Low           | 4                                       | Documented                         |
| Informational | 7                                       | Controls verified                  |

**No Critical or High finding remains unresolved within the implemented scope.**
This is **not** a production-readiness claim: PostgreSQL RLS, production SMTP,
deployment hardening, and a penetration test remain later work.

## Findings

### SEC-M1 — PostgreSQL RLS is not implemented

**Severity:** Medium (production hardening; accepted for Prompt 4)\
**Evidence:** `docs/database.md`; no `ROW LEVEL SECURITY` policies in migrations.\
**Impact:** Tenant isolation relies on service-layer scoping plus composite
tenant foreign keys. A direct database connection, a compromised application
process, or a future route that bypasses the services could access another
college's records. Composite foreign keys prevent cross-college _relationships_;
they do not authorize API requests.\
**Mitigation in place:** All services require a trusted `AuthenticatedActor`
derived from a verified session, reload role/college/memberships from PostgreSQL,
scope queries by `collegeId`, and return safe authorization/not-found errors.
Tests cover cross-college relationships, actor reload, and authorization.\
**Required follow-up:** Add RLS before production multi-tenant deployment, using
transaction-scoped `SET LOCAL app.college_id`, policies on every tenant-owned
table, and least-privilege database roles. Do not claim RLS exists today.

### SEC-M2 — Moderate development-tooling advisories

**Severity:** Medium, development-only (`npm audit`; production audit is checked
separately during final verification)\
**Evidence:** The full audit currently reports 8 moderate findings in
`eslint-config-next` → `typescript-eslint` → `minimatch`.\
**Impact:** A malicious/oversized glob could affect local lint tooling; it is not
shipped in the production runtime. The suggested automatic fix changes
`eslint-config-next` to a different major/downgrade and is not safe to apply
blindly.\
**Decision:** Accepted for this phase. Re-evaluate when the ESLint/TypeScript
toolchain supports patched `minimatch >=11.0.1`. Do not use `npm audit fix
--force` without reviewing the resulting dependency graph.

### SEC-M3 — SMTP is not configured, so production recovery is not operational

**Severity:** Medium operationally; not a code vulnerability\
**Evidence:** `EMAIL_ENABLED=false` locally and no production SMTP credentials
are configured. Non-production reset requests return a development link;
production deliberately never returns a token.\
**Impact:** Production password recovery cannot deliver email until SMTP is
configured. Users would need an administrator-assisted recovery process.\
**Mitigation:** Delivery code uses Nodemailer with timeouts, never logs tokens,
and audits delivery failures. The final verification report marks production
email/reset as **NOT CONFIGURED / NOT TESTED**.\
**Required follow-up:** Configure a transactional email provider, verify SPF/
DKIM/DMARC and link domains, and test delivery plus bounce handling.

### SEC-L1 — Local Docker credentials are committed as development defaults

**Severity:** Low (local-only, non-production)\
**Evidence:** `docker-compose.yml` and `.env.example` use
`campuspulse`/`campuspulse` and a local database on port 5434. `.env.local` is
ignored by Git.\
**Impact:** These are not production secrets, but copying them into a shared or
hosted environment would be unsafe.\
**Mitigation:** Documentation explicitly marks them local-only. Production must
use distinct secrets from a secret manager and a non-superuser database role.

### SEC-L2 — Audit immutability is application-level only

**Severity:** Low\
**Evidence:** `writeAuditLog`/`writeAuthAuditEvent` are only called by services;
no application service exposes update/delete. A database superuser can still
modify or delete rows.\
**Impact:** Audit records are trustworthy only if database access is controlled.\
**Mitigation:** Use least-privilege production roles, database backups, and
append-only/immutability controls before relying on audit records for compliance.

### SEC-L3 — IP rate limiting depends on trusted proxy headers

**Severity:** Low in a correctly configured deployment; potentially higher if the
app is exposed directly\
**Evidence:** `getClientIp()` reads `x-forwarded-for`, `x-real-ip`, or
`cf-connecting-ip`.\
**Impact:** A direct client could spoof an apparent IP and bypass IP-only limits.
Per-email/per-account limits still apply, and passwords are never accepted without
rate limiting.\
**Mitigation:** Deploy behind a trusted proxy/platform that overwrites these
headers. Do not expose the Node process directly to the public internet.

### SEC-L4 — Object existence is not fully normalized across tenants

**Severity:** Low\
**Evidence:** Some management services load the target before authorizing, so an
unauthorized caller can distinguish a missing object (404) from an existing
object in another college (403). Registration lookups fail closed with a tenant
error and do not expose the event.\
**Impact:** An authenticated actor can infer whether a specific UUID exists in
another tenant. No tenant-owned fields are returned, and identifiers are UUIDs,
so exploitation requires prior knowledge of an identifier.\
**Mitigation:** Route-level authorization and rate limiting are now implemented;
if stronger non-enumeration is required, scope initial target lookups by the
actor's college before returning an authorization error. This is not a
Critical/High issue for the current phase.

## Verified controls

1. **Authentication:** Better Auth 1.7.18 with database sessions, disabled public
   sign-up, Argon2id credential hashes, generic login errors, and disabled-account
   rejection.
2. **Sessions:** 7-day expiry, 24-hour rolling refresh, HttpOnly/SameSite=Lax
   cookies, Secure in production/HTTPS, database session revocation on password
   reset and role change.
3. **Password recovery:** 256-bit reset tokens stored only as SHA-256 hashes,
   30-minute expiry, single use, prior-token invalidation, session revocation,
   generic responses, and no production token return/logging.
4. **RBAC and tenant isolation:** Four-role system; actor identity/role/college/
   memberships reloaded from PostgreSQL; services require trusted actor context;
   deny-by-default checks; cross-tenant tests.
5. **CSRF/origin:** Server Actions plus explicit same-origin and
   `Sec-Fetch-Site` checks; Better Auth CSRF checks remain enabled.
6. **Rate limiting:** PostgreSQL atomic fixed-window limiter; HMAC lookup keys;
   no raw emails/IPs in rate-limit rows; policies for login, registration, and
   reset.
7. **CLI bootstrap:** No public endpoint, no default password, explicit
   confirmation, active-account requirement, transactional promotion, audit, and
   session revocation.
8. **Secret exposure:** `.env.local` is ignored; `.env.example` contains
   placeholders only. A final secret scan is part of verification.
9. **SQL injection:** Prisma parameterized queries; the only raw SQL in
   production code is the parameterized rate-limit upsert and registration
   locking query. No user-controlled SQL identifiers.
10. **Audit safety:** Recursive redaction of sensitive keys, string/depth/key
    bounds, atomic writes, separate anonymous auth audit table, no application
    mutation API, rollback tests.
11. **Test safety:** Exact `campuspulse_test` name, local-only host, separate
    `TEST_DATABASE_URL`, `current_database()` check before truncation, migration
    deploy against the test URL, and production refusal.
12. **Seed safety:** Requires `--confirm-development-seed`, refuses production,
    test database, and remote hosts; fictional local-only data and idempotent
    upserts.

## Residual risks

- No production deployment, PostgreSQL RLS, SMTP, secret manager integration, or
  penetration test exists yet. These are explicit later-phase work.
- A database superuser or direct SQL session bypasses service authorization.
- Audit rows can be altered by a database superuser.
- Development dependency advisories remain until the lint toolchain upgrades.
- New student accounts have `emailVerified=false`; there is no verification flow
  in this phase.
- Production password recovery is not operational until SMTP is configured.
- IP rate limiting relies on trusted proxy headers.
- Event creation is intentionally club-manager-only because the
  `events_createdById_collegeId_fkey` composite constraint requires the creator
  to belong to the event's college. Platform admins can review/transition
  existing events and approve clubs across colleges, but they cannot create a
  club-owned event. This is documented rather than weakening the tenant FK.

## Conclusion

No Critical/High issue was found in the implemented Prompt 4 scope. The Medium
items are an explicitly deferred production-hardening item (RLS), a
development-only transitive advisory, and missing production SMTP configuration.
Production deployment must wait for RLS/email/secret-manager hardening and a
separate deployment review.
