# Focused security review — Prompt 4

Scope: the database access layer, tenant helpers, event lifecycle, registration
integrity, club/role administration, audit logging, authentication, sessions,
password recovery, RBAC, CSRF/origin checks, PostgreSQL-backed rate limiting,
test-database safety, seed safety, and the landing/auth UI surface. The Prompt 5
addendum covers the dashboard and saved-event surface. The Prompt 6 addendum
covers authenticated poster upload/delivery and transactional notifications.
The Prompt 7 addendum covers local OCR, recommendations, duplicate review, and
schedule-conflict warnings. Public business APIs, production object storage, and
deployment remain out of scope.

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

## Prompt 5 addendum

Prompt 5 adds the four role dashboards and persistent saved events. The controls
reviewed for this addition are:

- Dashboard data access is server-only and every query accepts the trusted
  `AuthenticatedActor` first, re-checks the required role, and scopes by the
  actor's college or verified managed clubs.
- Layout guards redirect unauthenticated, disabled, and wrong-role users, but
  each page also performs its own authorization check.
- Dashboard Server Actions call `assertSameOrigin()` and
  `requireAuthenticatedUser()`, then invoke services that reload authorization
  state from PostgreSQL. Browser payloads do not supply actor identity, role,
  college, or club membership.
- Saved events use a unique `(studentProfileId, eventId)` pair and composite
  tenant foreign keys; save/unsave is idempotent and audited.
- No public business API or Prisma access from client components was added.
- Platform and college lifecycle/status changes revoke affected sessions.
- Dashboard analytics use SVG attributes, not inline `style` attributes. The
  production CSP keeps its nonce-based `style-src` and allows only the
  framework-owned `next-route-announcer` style through a narrow
  `style-src-attr` hash; `'unsafe-inline'` is not enabled in production.

Residual risks remain the same as the findings below: no PostgreSQL RLS, no
production notification/SMTP delivery, no penetration test, and application-level
audit immutability. See `docs/dashboards.md` for the route and action map.

## Prompt 6 addendum

Prompt 6 adds authenticated event-poster management, poster delivery, and
transactional in-app notifications. Addendum date: 2026-11-11.

### Controls reviewed

- **Upload authorization.** Upload, replacement, and removal require an active
  owning-club president/officer and are limited to `DRAFT`, `REJECTED`, and
  `PUBLISHED` events. `PENDING_APPROVAL`, `CANCELLED`, and `COMPLETED` are
  locked. College and platform administrators can review posters but cannot
  mutate them.
- **Content validation.** The server inspects file bytes, not the browser MIME
  type or filename. PNG signature/chunks/CRC, JPEG markers, and WebP RIFF/VP8
  containers are parsed. Empty, malformed, unsupported, SVG, HTML, executable,
  oversized, zero-dimension, and over-pixel files are rejected. The limit is
  5 MB; dimensions are capped at 12,000 px per side and 40,000,000 pixels total.
- **Storage safety.** Callers pass only a generated key matching
  `UUID.(jpg|png|webp)`. The local adapter rejects path traversal, writes a
  mode-`0600` temporary file, atomically renames it, refuses to overwrite an
  existing key, and never exposes filesystem paths. The storage root is outside
  `public/` and is not served by a static route.
- **Delivery authorization.** `GET /api/posters/[posterId]` requires an
  authenticated session. It returns `401` for unauthenticated requests and
  `404` for missing, unauthorized, cross-tenant, deleted, or storage-missing
  posters. Published posters are visible to authenticated same-college users
  while the event is published and the club is active. Unpublished posters are
  limited to the owning club manager, same-college college administrators, and
  platform administrators.
- **Response hardening.** Successful poster responses use
  `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`,
  `Cross-Origin-Resource-Policy: same-origin`, `Vary: Cookie`, and an inline
  filename with the detected extension. Errors return generic bodies.
- **Failure and cleanup.** A storage write failure returns `STORAGE_ERROR`
  without a database row. If the database transaction fails after the file
  write, the new file is deleted. A replaced or removed file is deleted after
  commit only when no poster row still references it. A failed cleanup can
  leave an orphan file but cannot leave a broken database reference.
- **Notifications.** Approval/rejection recipients are active club managers;
  cancellation recipients are confirmed registrants; registration recipients
  are the acting student. Recipient IDs are derived from the transaction, not
  browser input. Notification rows share the business transaction, and state
  guards prevent duplicate notifications on retries.
- **Audit.** `POSTER_UPLOADED`, `POSTER_REPLACED`, and `POSTER_REMOVED` are
  written in the same transaction as the poster metadata change. Audit metadata
  is redacted and bounded.
- **CSP.** The nonce-based CSP is unchanged. `img-src` permits `'self'`, `blob:`,
  and `data:` for local previews; `'unsafe-inline'` is not enabled. Poster bytes
  are delivered from the same origin through the authenticated route.

### Prompt 6 result

| Area                       | Result                                                              |
| -------------------------- | ------------------------------------------------------------------- |
| Critical findings          | 0 in the implemented Prompt 6 scope                                 |
| High findings              | 0 in the implemented Prompt 6 scope                                 |
| Medium findings            | 0 new code vulnerabilities found                                    |
| Residual operational risks | Local storage, no malware scan, no OCR/email                        |
| Automated coverage         | Unit/integration poster and notification tests; Playwright workflow |

This is not a production-readiness claim. The local filesystem adapter is for
development and single-instance self-hosting; production needs durable shared
storage, lifecycle/backup policy, and a malware-scanning decision. Notifications
are in-app only. PostgreSQL RLS and a penetration test remain future work. See
`docs/poster-storage.md` and `docs/event-operations.md`.

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

## Prompt 7 addendum

Prompt 7 adds local poster OCR, deterministic recommendations, advisory
duplicate review, and schedule-conflict warnings. Addendum date: 2026-11-13.

### Controls reviewed

- **OCR authorization and storage.** OCR is a server action that reloads the
  actor, event, club, and poster. It requires an active owning-club
  president/officer and a `DRAFT`/`REJECTED` event, then reuses the existing
  poster storage adapter and image validation. OCR does not expose raw poster
  bytes or storage keys to the browser.
- **Local processing.** Tesseract.js and bundled English traineddata run
  server-side. No external OCR, LLM, recommendation, or ranking service is
  called. `next.config.ts` keeps the worker and data packages external to the
  server bundle.
- **Duplicate-request safety.** An atomic status claim prevents two OCR workers
  from processing the same poster concurrently. Failures store a generic
  user-facing message while server logs retain diagnostic detail.
- **Review boundary.** OCR suggestions never publish, approve, submit, or
  bypass lifecycle rules. Accepted values are applied through the normal event
  update service with its validation, authorization, and audit path.
- **Recommendation scoping.** Recommendations accept only the trusted student
  actor, scope candidates to the student's college, exclude ineligible and
  already-engaged events, and use bounded bulk queries. No browser-supplied
  tenant or ranking input is trusted.
- **Duplicate review scoping.** Detection and review are college-scoped; the
  candidate query excludes the event itself and only considers non-deleted
  pending/published/completed events. Review requires a same-college college
  administrator and writes an audit record. It never merges, rejects, cancels,
  or deletes an event.
- **Conflict revalidation.** Registration revalidates conflicts server-side
  inside the transaction, records the result in audit metadata, and returns it
  to the UI. Conflicts are advisory; the current rules do not silently block a
  valid registration.
- **Timezone handling.** OCR wall-clock dates/times are interpreted in the
  college's IANA timezone and converted to UTC. Conflict overlap uses absolute
  timestamps; adjacent intervals do not conflict.
- **CSP and client behavior.** New UI uses existing components and server
  actions. No inline style or script allowance was added.

### Residual risks for this addendum

- OCR is English-only and accuracy varies with poster quality; ambiguous values
  require organizer review.
- OCR runs in the request process without a durable queue or per-request CPU
  budget beyond the platform timeout.
- Recommendations and duplicate detection are deterministic rules, not
  semantic models; they can produce false negatives and lexical false
  positives.
- Duplicate and schedule warnings are advisory and do not enforce operational
  policy.
- No new secret or external API credential is introduced by Prompt 7.

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
- Poster storage is local and single-instance; it is not shared, CDN-backed,
  malware-scanned, or covered by a production lifecycle/backup policy.
- Notifications are in-app only; there is no email/push/SMS delivery or
  background outbox.
- Event creation is intentionally club-manager-only because the
  `events_createdById_collegeId_fkey` composite constraint requires the creator
  to belong to the event's college. Platform admins can review/transition
  existing events and approve clubs across colleges, but they cannot create a
  club-owned event. This is documented rather than weakening the tenant FK.

## Conclusion

No Critical/High issue was found in the implemented Prompt 4 scope. The Medium
items are an explicitly deferred production-hardening item (RLS), a
development-only transitive advisory, and missing production SMTP configuration.
Prompt 6 found no new Critical/High code issue in the poster and notification
surface. Prompt 7 found no new Critical/High code issue in the OCR,
recommendation, duplicate-review, or conflict-warning surface; residual risks are
the documented advisory/accuracy limitations. Production deployment must wait
for RLS/email/secret-manager hardening, durable shared poster storage, and a
separate deployment review.
