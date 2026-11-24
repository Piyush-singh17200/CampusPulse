# Production Hardening — Production Readiness Audit

- **Date:** 18 November 2026
- **Branch:** `main` at `daaf99dbff3a7b9c443ab94efd662896a16914db`
- **Auditor:** OpenCode agent (Phase A inspection)
- **Scope:** authentication, authorization, tenant isolation, audit logging,
  validation, uploads/OCR, exports, reliability, performance, accessibility,
  environment configuration, storage, and deployment readiness.
- **Constraint:** the development database was inspected read-only. Destructive
  verification used only the isolated `campuspulse_test` database.

## 1. Executive summary

CampusPulse already has an unusually strong security baseline for a
project of this size: Argon2id password hashing, hashed single-use reset
tokens, database-backed sessions that are re-verified on every request,
fresh actor reloads, composite tenant foreign keys, row-locked capacity
checks, content-signature image validation, audit metadata redaction, and a
nonce-based CSP.

The audit found **no Critical issues**, **three High issues**, **five Medium
issues**, and **four Low issues**. The High issues are all production
operational risks rather than authorization bypasses:

1. expensive authenticated operations (OCR, uploads, exports, feedback,
   attendance scanning, event mutations) had no per-user rate limits;
2. OCR could be retried indefinitely on failure with no execution timeout;
3. poster storage had no durable production adapter and its directory was
   outside the validated environment contract.

All High and Medium findings were remediated in this release. Low findings
were either fixed or explicitly accepted with a documented rationale.

| Severity | Found | Resolved | Accepted |
| -------- | ----- | -------- | -------- |
| Critical | 0     | 0        | 0        |
| High     | 3     | 3        | 0        |
| Medium   | 5     | 5        | 0        |
| Low      | 4     | 2        | 2        |

## 2. Baseline verification (before changes)

| Check                            | Result                                            |
| -------------------------------- | ------------------------------------------------- |
| Branch / HEAD                    | `main` / `daaf99d`                                |
| Working tree                     | dirty (Event Operations work preserved; no reset) |
| Node / npm                       | v24.13.0 / 11.6.2                                 |
| Prisma                           | 7.10.1                                            |
| TypeScript                       | `npm run typecheck` — pass                        |
| ESLint                           | `npm run lint` — pass                             |
| Prisma validate / migrate status | schema valid; 7 migrations; database up to date   |
| Database health                  | `campuspulse` on `localhost:5434` — OK (214 ms)   |
| Unit / integration tests         | 28 files, 215 tests — pass (86.28 s)              |
| Production dependency audit      | see L-2                                           |

## 3. Findings

### H-1 — No per-user rate limits on expensive authenticated operations

**Severity:** High (availability / cost / abuse)

**Evidence:**

- `src/server/auth/rate-limit.ts:21-33` defines policies only for login,
  registration, and password reset.
- `src/features/dashboards/actions.ts` executes OCR, poster upload/removal,
  event create/update/transition, attendance scan/correction, feedback
  writes, and administrative mutations after `assertSameOrigin()` and
  `requireAuthenticatedUser()` but with no throttle.
- `src/app/api/exports/**/route.ts` and `src/app/api/calendar/**/route.ts`
  authenticate and authorize, then perform database-heavy exports with no
  throttle.

**Impact:** a compromised or malicious authenticated account can consume CPU
with repeated OCR, churn poster storage, or run repeated aggregate export
queries. The existing login limiter does not protect authenticated surfaces.

**Remediation:** added PostgreSQL-backed per-user policies for OCR, poster
writes, export downloads, feedback writes, attendance scanning/correction,
event writes, registration writes, and administrative mutations. Policies
are enforced at the action/route boundary so service-level tests remain
deterministic. Limits are keyed by HMAC of the user ID, never the raw ID.

**Status:** Resolved (Phase B). See `docs/SECURITY_HARDENING.md`.

### H-2 — OCR retries were unbounded and execution had no timeout

**Severity:** High (availability / CPU exhaustion)

**Evidence:**

- `src/services/poster-ocr.ts:359-371` claims posters in `NOT_REQUESTED` or
  `FAILED` state. A `FAILED` poster can be re-claimed immediately, forever.
- `src/server/ocr/tesseract-engine.ts:51-69` creates a Tesseract worker and
  awaits `worker.recognize()` with no deadline. A malformed or pathological
  image can hold the worker for an unbounded time.
- `runPosterOcrAction` had no throttle (see H-1).

**Impact:** a club manager could repeatedly trigger expensive Tesseract runs
on a failing poster. Combined with the absence of a timeout, this is a
practical CPU-exhaustion vector against a single Node.js instance.

**Remediation:**

- added a bounded OCR execution timeout (`OCR_TIMEOUT_MS`) with explicit
  worker termination;
- added a failure cooldown (`OCR_FAILURE_RETRY_COOLDOWN_MS`) so a recently
  failed poster cannot be retried immediately;
- added a per-user OCR rate limit (H-1);
- preserved the existing atomic `PROCESSING` claim so concurrent requests
  cannot run duplicate OCR for the same poster.

**Status:** Resolved (Phase C). See `docs/RELIABILITY_REPORT.md`.

### H-3 — Poster storage was local-only with no durable production adapter

**Severity:** High (production data loss / multi-instance correctness)

**Evidence:**

- `src/server/storage/poster-storage.ts` implements only
  `createLocalPosterStorage`.
- `docs/poster-storage.md:216-228` explicitly states the local adapter is not
  production-ready cloud storage.
- `POSTER_STORAGE_DIR` was read directly from `process.env` at
  `poster-storage.ts:138` and was absent from `src/config/env.ts`, so a
  production deployment could start with an invalid or ephemeral path.

**Impact:** on an ephemeral filesystem or a multi-instance deployment,
uploads disappear on restart and are not visible across instances.

**Remediation:** added an S3-compatible `PosterStorage` adapter selected by
`POSTER_STORAGE_DRIVER`, with SigV4 request signing implemented using Node
crypto (no new runtime dependency), strict key validation, path-style and
virtual-host addressing, and unit tests against the published AWS SigV4 test
vector. Local storage remains the default for development. The environment
schema and `.env.example` now document and validate both drivers.

**Status:** Resolved (Phase F). Live object-storage verification requires
credentials that were not available; see the residual-risk section.

### M-1 — Sensitive exports were not audit-logged

**Severity:** Medium (accountability)

**Evidence:**

- `src/app/api/exports/club/attendance/route.ts` exports student names, roll
  numbers, departments, and attendance status.
- `src/app/api/exports/**` and `src/app/api/calendar/**` did not call
  `writeAuditLog` or any equivalent.
- `AuditAction` in `prisma/schema.prisma:136-166` had no export action.

**Impact:** an operator could not answer "who downloaded the attendance
roster, and when?" from application data.

**Remediation:** added `EXPORT_DOWNLOADED` to the audit enum (additive
migration), a shared `recordExportAudit` helper, and audit writes in every
CSV and ICS download route. Metadata records the export kind, scope, and row
count only — never student data. Audit failure fails the download closed.

**Status:** Resolved (Phase B).

### M-2 — Rate limiter fail-closed comment did not match behaviour

**Severity:** Medium (authentication availability semantics)

**Evidence:** `src/server/auth/rate-limit.ts:87-98` handles an empty result
set, but a thrown PostgreSQL error propagates out of `consumeRateLimit`. The
comment at line 90 claims a database failure fails closed for authentication.

**Impact:** behaviour was effectively fail-closed at the caller (the action
returned an error), but the contract was implicit and could regress.

**Remediation:** wrapped the SQL call in an explicit `try/catch`, logged only
the error name, and returned a denied result with a full-window retry. Added
a regression test using a spied failing query.

**Status:** Resolved (Phase B).

### M-3 — No HTTP health endpoint

**Severity:** Medium (operations)

**Evidence:** the only health check was the CLI script
`scripts/check-db.ts` (`npm run db:health`). There was no route a load
balancer, uptime monitor, or container orchestrator could probe.

**Impact:** deployments could not distinguish a running process from a
process that had lost its database.

**Remediation:** added `GET /api/health`, a public, no-store JSON endpoint
with a bounded database probe (2 s). It returns `200` with latency when the
database is reachable and `503` with no internal details otherwise.

**Status:** Resolved (Phase C).

### M-4 — Storage configuration was outside the environment contract

**Severity:** Medium (deployment correctness)

**Evidence:** `.env.example:51` mentioned `POSTER_STORAGE_DIR` only as a
comment, and `src/config/env.ts` did not validate it or any S3 settings.

**Impact:** a typo or missing production value would surface only at the
first upload.

**Remediation:** extended `src/config/env.ts` with `POSTER_STORAGE_DRIVER`,
`POSTER_STORAGE_DIR`, and S3 endpoint/region/bucket/credential/prefix
variables, including conditional requirements when the S3 driver is selected.
Startup now fails with field names only (never values).

**Status:** Resolved (Phase F).

### M-5 — Expired rate-limit rows were never pruned automatically

**Severity:** Medium (database growth)

**Evidence:** `pruneExpiredRateLimits` existed at
`src/server/auth/rate-limit.ts:115-119` but had no caller in `src/` or
`scripts/`.

**Impact:** the `rate_limit_entries` table grows without bound in production.

**Remediation:** added opportunistic pruning (1% of successful limiter calls)
and an operator script `npm run db:prune-rate-limits` for scheduled cleanup.
The test suite still calls the prune function deterministically.

**Status:** Resolved (Phase B).

### L-1 — Stale account-page copy

**Severity:** Low (product polish)

**Evidence:** `src/app/account/page.tsx:43-46` said role-specific workspaces
"will be added in later phases", although all four dashboards now exist.

**Remediation:** replaced the sentence with accurate copy and a direct link
to the user's role workspace. No layout or behavioural change.

**Status:** Resolved (Phase E).

### L-2 — Development-tooling dependency advisories

**Severity:** Low (supply chain, development only)

**Evidence:** `npm audit` reports 17 advisories (6 moderate, 11 high) in the
`minimatch` / `picomatch` chains used by ESLint, Vitest, and Prisma tooling.
`npm audit --omit=dev` still reports the chain because Vitest is an optional
peer dependency of `better-auth`.

**Impact:** build and test tooling only; the vulnerable glob packages are not
imported by the production request path. `npm audit fix --force` would break
pinned major versions.

**Decision:** accepted for this release. Re-evaluate when the upstream
toolchain publishes compatible releases. No `--force` fix was applied.

**Status:** Accepted (documented).

### L-3 — No structured request logging or correlation IDs

**Severity:** Low (observability)

**Evidence:** error paths use `console.error` with error names/digests only
(5 call sites). There is no request ID, JSON log format, or log shipping
configuration.

**Impact:** incident triage depends on the hosting provider's log capture.

**Decision:** accepted for this release. The application deliberately avoids
logging request bodies or identifiers; adding a logging framework is an
infrastructure decision that requires the hosting provider choice. The
runbook documents the minimum log retention and alerting expectations.

**Status:** Accepted (documented).

### L-4 — CSP is applied to pages, not API responses

**Severity:** Low / informational

**Evidence:** `src/proxy.ts:56-65` excludes `/api` from the nonce-CSP matcher.
Global security headers from `next.config.ts` still apply to API routes.

**Impact:** none for JSON, CSV, ICS, image, and health responses. A CSP on a
non-HTML response has no effect; the exclusion avoids unnecessary nonce work
on downloads.

**Decision:** accepted as intentional. API responses retain
`X-Content-Type-Options`, `Cross-Origin-Resource-Policy`, and
`Cache-Control: private, no-store` where applicable.

**Status:** Accepted (documented).

## 4. Controls verified as effective

- **Password storage:** Argon2id with tuned parameters; no plaintext or
  reversible storage.
- **Sessions:** database-backed, `disableCookieCache`, HttpOnly, SameSite=Lax,
  Secure in production; session revocation on password reset and account
  status change.
- **Authorization:** every dashboard layout and page re-resolves the actor;
  services re-check role, college, club membership, and record ownership.
- **Tenant isolation:** composite foreign keys include `collegeId`; services
  scope reads and writes by tenant; cross-tenant lookups return `404` rather
  than confirming existence.
- **CSRF:** server actions call `assertSameOrigin`; Better Auth CSRF checks
  remain enabled; no public `/api/auth/[...all]` route is mounted.
- **Input validation:** Zod schemas at service boundaries; UUID validation;
  bounded string lengths; no raw SQL interpolation (parameterized Prisma
  queries and tagged templates only).
- **Uploads:** content-signature validation for PNG/JPEG/WebP, 5 MB limit,
  40 MP limit, path-traversal-safe storage keys, no overwrite, authenticated
  delivery with `nosniff`.
- **Audit:** actor, action, entity, tenant, and redacted metadata; sensitive
  keys are redacted recursively; export auditing added in this release.
- **Headers:** CSP with per-request nonce, HSTS in production,
  `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- **Capacity:** row-locked registration checks; unique constraints as a
  second line of defence.
- **Attendance tokens:** 256-bit random tokens stored only as SHA-256 hashes;
  check-in window enforced server-side.
- **CSV:** UTF-8 BOM, CRLF, formula-injection escaping, tenant-scoped rows.

## 5. Deployment gate

| Gate                                      | Status                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| No Critical findings                      | Pass                                                                                       |
| No unresolved High findings               | Pass (after remediation)                                                                   |
| Typecheck / lint / format                 | Pass (see final verification report)                                                       |
| Unit / integration tests                  | Pass (see final verification report)                                                       |
| Production build                          | Pass (see final verification report)                                                       |
| Playwright end-to-end                     | Production Hardening: 5/5; full regression: **9/9** against the production build (1.4 min) |
| First-tenant bootstrap                    | Pass — guarded CLI verified against `campuspulse_test`                                     |
| Production credentials and hosting choice | **Blocked — not provided**                                                                 |
| Explicit approval to deploy               | **Blocked — not granted**                                                                  |

The full Playwright suite is green in one clean run against the production
build (9/9 in 1.4 min). That run also found and closed a production-only CSP
attribute-hash gap for `next/image`. See
`docs/PRODUCTION_VERIFICATION_REPORT.md`.

Deployment remains intentionally pending. This audit does not authorise a
deployment.

## 6. Residual risk

1. **Object storage was not exercised against a live bucket.** The S3 adapter
   is covered by signing/request-construction unit tests and configuration
   validation, but no credentials were available for an integration test.
   Run the verification steps in `docs/DEPLOYMENT_GUIDE.md` before
   trusting production uploads.
2. **Email delivery was not exercised against a live SMTP server.** The
   existing development fallback and production guard were reviewed; SMTP
   credentials were not available.
3. **Single-process rate limiting assumptions.** Limits are stored in
   PostgreSQL and are therefore shared across instances, but fixed windows
   allow a burst at a window boundary. This is an accepted trade-off.
4. **In-process OCR.** Tesseract runs inside the web process. The timeout and
   per-user limit bound the damage, but a dedicated worker is the preferred
   long-term architecture.
5. **No WAF / DDoS protection.** This is a hosting-layer concern and is
   documented in the production architecture guide.

## 7. Deployment preparation addendum

A first-tenant bootstrap gap was found during deployment preparation:
registration requires an active college, the platform dashboard does not expose
tenant creation, and the production database starts empty. A confirmation-gated
`npm run college:bootstrap` CLI was added. It validates its input, refuses a
duplicate slug or domain, and creates only the college — no user, password, or
default administrator. It was verified against `campuspulse_test` (create,
duplicate refusal, cleanup). The full sequence is in
`docs/DEPLOYMENT_GUIDE.md`.

## 8. Evidence index

- Baseline test log: `.data/baseline-test.log` (28 files / 215 tests).
- Security hardening details: `docs/SECURITY_HARDENING.md`.
- Reliability details: `docs/RELIABILITY_REPORT.md`.
- Performance measurements: `docs/PERFORMANCE_REPORT.md`.
- Accessibility review: `docs/ACCESSIBILITY_REPORT.md`.
- Production architecture: `docs/PRODUCTION_ARCHITECTURE.md`.
- Deployment procedure: `docs/DEPLOYMENT_GUIDE.md`.
- Environment reference: `docs/ENVIRONMENT_REFERENCE.md`.
- Backup and recovery: `docs/BACKUP_AND_RECOVERY.md`.
- Operations runbook: `docs/OPERATIONS_RUNBOOK.md`.
- Final verification: `docs/PRODUCTION_VERIFICATION_REPORT.md`.
