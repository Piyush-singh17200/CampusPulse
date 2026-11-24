# Production Hardening — Security Hardening Report

**Project:** CampusPulse
**Date:** 18 November 2026
**Scope:** Production Hardening security hardening and verification
**Status:** Implemented and verified locally; production deployment remains gated (see §8)

This report records the security changes made in Production Hardening. It does not replace
the existing architecture and authorization documentation. The controlling
design remains: every request is authenticated on the server, every query is
tenant-scoped, and every privileged mutation writes an audit row.

## 1. Threat model summary

CampusPulse is a multi-tenant campus operations application. The relevant
assets are:

- Account credentials, sessions, and password-reset tokens.
- Student registration, attendance, and profile data.
- Club, college, and platform administration capabilities.
- Event posters (uploaded binary content).
- CSV and calendar exports, which aggregate personal data.
- Audit records and administrative actions.

The Production Hardening review focused on abuse that does not require a code exploit:

| Threat                                   | Example                                                                               | Production Hardening response                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Credential stuffing                      | Repeated login attempts against one email or many emails from one IP                  | Existing DB-backed login limits retained; verified                                |
| Authenticated abuse                      | A valid club account repeatedly uploading, OCR-ing, exporting, or scanning attendance | New per-user DB-backed policies at action/route boundaries                        |
| Export data exfiltration without a trail | Downloading attendance CSVs repeatedly                                                | Per-user export limit plus `EXPORT_DOWNLOADED` audit row                          |
| OCR resource exhaustion                  | Submitting many posters to a CPU-heavy Tesseract worker                               | Per-user OCR limit, 12 s worker timeout, 60 s failure cooldown, deadline backstop |
| Storage-path abuse                       | Crafting keys or prefixes to escape the poster namespace                              | Shared key validation, traversal rejection, S3 prefix validation                  |
| Information disclosure through probes    | Health endpoint revealing connection strings, versions, or stack traces               | Minimal public health payload; no secrets or error text                           |
| Rate-limiter bypass                      | In-memory counters that reset on restart or differ per instance                       | PostgreSQL fixed-window counters shared by all instances                          |
| Fail-open limiter                        | Database outage disables brute-force protection                                       | Limiter denies on database failure                                                |

## 2. Per-user rate limits

`src/server/auth/rate-limit.ts` now defines authenticated policies in addition
to the existing authentication policies. The limiter is a single atomic
`INSERT ... ON CONFLICT` statement in PostgreSQL, keyed by an HMAC of the
namespace and value. It is shared across processes and deployments.

| Policy                    | Key              | Limit | Window | Applied at                             |
| ------------------------- | ---------------- | ----- | ------ | -------------------------------------- |
| `loginEmail`              | Normalized email | 5     | 15 min | Login action                           |
| `loginIp`                 | Client IP        | 20    | 15 min | Login action                           |
| `registrationIp`          | Client IP        | 5     | 60 min | Registration action                    |
| `registrationEmail`       | Normalized email | 3     | 60 min | Registration action                    |
| `passwordResetEmail`      | Normalized email | 3     | 60 min | Forgot-password action                 |
| `passwordResetIp`         | Client IP        | 10    | 60 min | Forgot-password action                 |
| `passwordResetCompleteIp` | Client IP        | 10    | 60 min | Reset-completion action                |
| `posterUploadUser`        | User ID          | 20    | 10 min | Poster upload/replace/remove           |
| `posterOcrUser`           | User ID          | 10    | 10 min | Poster OCR                             |
| `exportDownloadUser`      | User ID          | 30    | 10 min | All CSV and ICS download routes        |
| `feedbackWriteUser`       | User ID          | 30    | 60 min | Feedback create/update/delete          |
| `attendanceScanUser`      | User ID          | 300   | 10 min | Attendance scan/lookup                 |
| `attendanceWriteUser`     | User ID          | 240   | 10 min | Attendance status writes               |
| `eventWriteUser`          | User ID          | 120   | 60 min | Event create/update/submit/cancel      |
| `registrationWriteUser`   | User ID          | 120   | 60 min | Student registration/cancel            |
| `adminWriteUser`          | User ID          | 120   | 60 min | College/platform administrative writes |

Design decisions:

- **Boundary enforcement.** `enforceRateLimit()` is called from server actions
  and route handlers, not from domain services. Service-level tests therefore
  remain deterministic and do not need a limiter fixture.
- **Fail closed.** A database error returns a denied result. The limiter logs
  only the error class, never the query, connection string, or key material.
- **No PII in keys.** Keys are HMAC-SHA256 digests. Email addresses are
  normalized but never stored in the limiter table in plaintext.
- **Bounded table.** Expired rows are pruned opportunistically (about 1% of
  successful calls) and by the deterministic command
  `npm run db:prune-rate-limits`. Opportunistic pruning is disabled under
  `NODE_ENV=test`.
- **Shared 429 response.** `RateLimitedError` is converted by
  `src/server/http/responses.ts` into a `429` with a `Retry-After` header.

## 3. Export download auditing

All four CSV export routes and all three calendar ICS routes now:

1. Require an authenticated actor.
2. Enforce `exportDownloadUser`.
3. Write an `EXPORT_DOWNLOADED` audit row after the data is authorized.
4. Return `Cache-Control: no-store` download headers.

Audit shape:

```text
action:     EXPORT_DOWNLOADED
entityType: Export
entityId:   <kind>:<scope>          (maximum 120 characters)
metadata:   { kind, format, scope, rowCount? }
```

Examples:

| Export                     | Entity ID                       |
| -------------------------- | ------------------------------- |
| Club attendance CSV        | `club-attendance:<eventId>`     |
| Club analytics CSV         | `club-analytics:<clubId>`       |
| College analytics CSV      | `college-analytics:<collegeId>` |
| Platform analytics CSV     | `platform-analytics:platform`   |
| Registered-events calendar | `calendar-registered:<userId>`  |
| Saved-events calendar      | `calendar-saved:<userId>`       |
| Single-event calendar      | `calendar-event:<eventId>`      |

The metadata deliberately contains **no student names, roll numbers,
departments, filenames, or file contents**. The row count is an integer and is
safe to retain. The `EXPORT_DOWNLOADED` enum value was added by migration
`prisma/migrations/20261118111909_export_audit/migration.sql`.

Verification: `tests/e2e/production-hardening.spec.ts` downloads a club attendance CSV as
the seeded club president, asserts the UTF-8 BOM and CSV header, and reads the
audit row back from PostgreSQL. It also asserts that the limiter table received
a row after the login window was cleared. The test cleans up its audit and
limiter rows.

## 4. OCR abuse controls

Event Intelligence introduced Tesseract-based poster OCR. Production Hardening adds:

- `OCR_DEFAULT_TIMEOUT_MS = 12_000` in `src/server/ocr/constants.ts` (12 s execution bound).
- A Tesseract worker timeout with proactive abort signal support that terminates
  the worker instead of leaving it running.
- A `runOcrWithDeadline` backstop that races the engine against a deadline
  (14 s by default, safely below the 15 s serverless limit; tests can inject a shorter `ocrTimeoutMs`).
- A per-poster failure cooldown of 60 s (`OCR_FAILURE_RETRY_COOLDOWN_MS`) to
  prevent tight retry loops after a timeout or engine failure.
- A safe `OCR_TIMEOUT` domain code and user-facing message. Internal worker
  errors and stack traces are not returned to the browser.
- Lazy loading of the Tesseract adapter. The worker, WASM, and language data
  are imported only when OCR is actually requested. This also prevents the
  build-time memory exhaustion described in the performance report.

The OCR route is additionally bounded by `posterOcrUser` and the existing
poster authorization rules.

## 5. Storage hardening

Poster storage now supports two drivers selected by `POSTER_STORAGE_DRIVER`:

- `local` (default): durable single-instance filesystem storage.
- `s3`: any SigV4-compatible object store (AWS S3, Cloudflare R2, Backblaze B2,
  MinIO).

Shared rules in `src/server/storage/poster-key.ts`:

- Keys must match `UUID.(jpg|png|webp)`.
- Path traversal and absolute paths are rejected.
- The S3 adapter rejects unsafe prefixes, including `..` segments.
- The local adapter resolves keys under its root and refuses to overwrite.
- The S3 adapter uses `If-None-Match: *` on PUT, a 15 s request timeout, and a
  private bucket. It returns `null` for a missing object and a generic
  `STORAGE_ERROR` for any other failure.

The delivery route remains authenticated and tenant-aware. There are no public
poster URLs and no signed URLs. Bucket policy, encryption, versioning, and
lifecycle rules are deployment configuration, not application code.

The SigV4 signer is dependency-free and verified against the published AWS S3
GET Object test vector in `tests/services/s3-signing.test.ts`.

## 6. Health endpoint

`GET /api/health` is public by design for load balancers and uptime monitors.
It returns only:

```json
{
  "status": "ok",
  "checkedAt": "…",
  "uptimeSeconds": 123,
  "checks": { "database": { "status": "ok", "latencyMs": 2 } }
}
```

On failure it returns `503` with `database.status: "error"` and no error
message. It does not return connection strings, environment variables, schema
versions, dependency versions, or stack traces. Responses use
`Cache-Control: no-store` and `X-Content-Type-Options: nosniff`.

The database probe has a 2 s timeout so a hung database cannot hang the health
check indefinitely.

## 7. Existing controls re-verified

Production Hardening did not weaken these controls:

- Argon2id password hashing.
- Hashed, single-use password-reset tokens with expiry.
- Database-backed sessions and server-side actor reloads on every request.
- Composite tenant foreign keys and tenant-scoped service queries.
- Row-locked capacity checks for event registration.
- Content-signature image validation (JPEG/PNG/WebP only).
- Audit redaction and tenant-scoped audit queries.
- Nonce-based CSP, HSTS in production, `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, COOP, CORP, and no
  `X-Powered-By`.
- Secure, HTTP-only cookies in production.
- No public `/api/auth/[...all]` route; auth mutations are same-origin server
  actions with database rate limits.
- No default administrator or startup provisioning. The first college is
  created by a confirmation-gated CLI; the first account is registered through
  the normal flow and promoted by a separate confirmation-gated CLI that
  revokes the account's sessions. Neither command creates a password.

## 8. Residual risks and accepted items

| Risk                                           | Status                  | Notes                                                                                                                                                                     |
| ---------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3 adapter not exercised against a live bucket | Open                    | Signing is unit-tested; deployment must run the smoke test in the deployment guide before going live.                                                                     |
| SMTP not exercised against a live provider     | Open                    | Password recovery requires `EMAIL_ENABLED=true`; verify delivery during deployment.                                                                                       |
| No WAF or managed bot protection               | Accepted                | The DB limiter, same-origin actions, CSP, and secure cookies are the current controls. A reverse proxy/WAF can be added without application changes.                      |
| No malware scanning of posters                 | Accepted                | Only content-validated JPEG/PNG/WebP are accepted; images are served with `nosniff`, `CORP: same-origin`, and `Content-Disposition: inline` under an authenticated route. |
| `npm audit` dev-tooling advisories             | Accepted                | Documented in the readiness audit; no `npm audit fix --force` was used.                                                                                                   |
| Distributed denial of service                  | Partially mitigated     | Per-user and per-IP limits bound application abuse; volumetric DDoS must be handled by the hosting/proxy layer.                                                           |
| Audit retention                                | Policy decision pending | Rows are retained indefinitely; the operations runbook defines a review point before any retention policy is applied.                                                     |
| PostgreSQL RLS                                 | Not adopted             | Existing app-layer scoping and composite foreign keys remain the isolation mechanism. RLS is documented as a future defense-in-depth option, not a replacement.           |

## 9. Verification evidence

| Check                                           | Result                                                     |
| ----------------------------------------------- | ---------------------------------------------------------- |
| Full unit/integration suite                     | 31 files / 235 tests passed (105.25 s)                     |
| Production Hardening hardening tests            | 9 tests in `tests/services/production-hardening.test.ts`   |
| SigV4 test vector and session-token test        | 3 tests in `tests/services/s3-signing.test.ts`             |
| Hardening E2E (development)                     | 5/5 passed (31.2 s)                                        |
| Hardening E2E (production build, final)         | 5/5 passed (11.1 s)                                        |
| Full Playwright regression (production build)   | 9/9 passed (1.4 min)                                       |
| Unauthenticated export/calendar/poster requests | `401` verified by E2E                                      |
| Export audit and limiter rows                   | Verified end to end by E2E                                 |
| Security headers                                | Verified in development and production                     |
| Health payload                                  | Verified to contain no connection string or `DATABASE_URL` |

Commands and exact output are recorded in
`docs/PRODUCTION_VERIFICATION_REPORT.md`.

## 10. References

- `docs/PRODUCTION_READINESS_AUDIT.md`
- `docs/RELIABILITY_REPORT.md`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/poster-storage.md`
- `src/server/auth/rate-limit.ts`
- `src/server/exports/audit.ts`
- `src/server/storage/s3-poster-storage.ts`
- `src/app/api/health/route.ts`
- `tests/e2e/production-hardening.spec.ts`
