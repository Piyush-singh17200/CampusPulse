# Prompt 9 — Reliability Report

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Implemented and verified locally; production operations remain gated

This report describes the reliability controls added or verified in Prompt 9,
the failure modes that remain, and the checks an operator must run before and
after deployment.

## 1. Reliability goals

CampusPulse is a server-rendered Next.js application backed by PostgreSQL.
The reliability goals for the first production deployment are:

| Goal                        | Target                                                                 | Current status                                                                |
| --------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Readiness signal            | A load balancer can distinguish “process up” from “database reachable” | `GET /api/health` returns `200` or `503` with a 2 s database probe            |
| Authentication availability | A database outage must not become an open brute-force window           | Limiter fails closed                                                          |
| Request boundedness         | No single OCR or export request can run unbounded                      | OCR deadline + worker timeout; exports are bounded queries                    |
| Failure containment         | A poster, email, or OCR failure must not corrupt event data            | Poster cleanup semantics; email failures audited; OCR status persisted safely |
| Deployment repeatability    | A clean build and migration can be reproduced                          | Build, migration, and seed commands documented                                |
| Recovery                    | Database and poster storage can be restored                            | Backup/recovery runbook created; restore drill not yet performed              |

## 2. Health and readiness

`GET /api/health` is implemented in `src/app/api/health/route.ts`:

- Runs `SELECT 1` through the shared Prisma client.
- Races the probe against a 2 s timeout.
- Returns `200` with `{ status: "ok", checkedAt, uptimeSeconds, checks.database }`
  when the database responds.
- Returns `503` with `{ status: "error", checks.database.status: "error" }`
  when it does not.
- Uses `Cache-Control: no-store, max-age=0` and `X-Content-Type-Options: nosniff`.
- Exposes no connection strings, environment values, dependency versions, or
  error text.

Measured on the production build:

| Run | Total   | Database latency |
| --- | ------- | ---------------- |
| 1   | 24.3 ms | 2 ms             |
| 2   | 20.8 ms | 2 ms             |
| 3   | 21.0 ms | 1 ms             |
| 4   | 19.7 ms | 2 ms             |
| 5   | 17.5 ms | 1 ms             |

The `503` path is implemented and code-reviewed. It was **not** exercised by a
fault-injection test in this environment because stopping PostgreSQL would
interrupt the rest of the verification run. This is recorded as a test gap, not
as a verified production behavior.

Recommended probe configuration:

- Liveness: TCP connect or a lightweight process check, every 10–30 s.
- Readiness: `GET /api/health`, every 30 s, timeout 5 s, 2–3 failures before
  removing an instance.
- Alert on three consecutive `503` responses or on a database latency above
  1,000 ms for five minutes.

## 3. Database connection behavior

`src/server/db/factory.ts` creates the Prisma client with:

- `DATABASE_URL` for application queries.
- `DATABASE_POOL_MAX` (default 10).
- `DATABASE_CONNECTION_TIMEOUT_MS` (default 5,000 ms).
- `DATABASE_IDLE_TIMEOUT_MS` (default 30,000 ms).
- Optional `DATABASE_SSL=true` for TLS-required providers.
- Query logging only when `DATABASE_LOG_QUERIES=true`; this must remain off in
  production because query parameters can contain personal data.

A single client is reused across development hot reloads and normal production
requests. The application does not create a client per request.

Operational implications:

- Size the database connection limit above the sum of app instances × pool
  size, with headroom for migrations and monitoring.
- A pool exhaustion event surfaces as a request failure, not as an unbounded
  queue. The connection timeout bounds the wait.
- `DIRECT_URL` is for the Prisma CLI and migrations. It should not be used by
  the running application when the provider offers a pooled URL.

## 4. OCR reliability

The OCR path is the most CPU-intensive request in the application. Prompt 9
bounds it in four layers:

1. **Per-user budget.** `posterOcrUser` allows 10 OCR requests per 10 minutes
   per user.
2. **Worker timeout.** The Tesseract worker is given 60 s. On timeout it is
   terminated rather than left alive.
3. **Deadline backstop.** `runOcrWithDeadline` races the engine against
   `OCR_DEFAULT_TIMEOUT_MS + 5,000` (65 s by default). Tests can inject a
   shorter `ocrTimeoutMs`.
4. **Failure cooldown.** After an OCR failure or timeout, the same poster
   cannot be retried for 60 s. This prevents a client from immediately
   re-triggering an expensive failure.

The engine is loaded lazily:

```ts
const engine =
  dependencies.engine ?? (await import("@/server/ocr/tesseract-engine")).recognizePosterImage;
```

This keeps the Tesseract worker, WASM, and English language data out of the
module graph for non-OCR routes and out of every build worker. It also reduced
the production build's memory pressure (see §8).

Failure behavior:

| Failure                              | User-visible result                     | Persistence                                                         |
| ------------------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| OCR timeout                          | Safe `OCR_TIMEOUT` message              | Poster remains; OCR status reflects failure; retry cooldown applies |
| Engine import/initialization failure | Safe generic OCR failure                | Poster remains; retry cooldown applies                              |
| No text found                        | “No text found” state, not an exception | OCR status persisted                                                |
| Rate limit exceeded                  | `429` with `Retry-After`                | No OCR work performed                                               |

OCR remains a best-effort convenience. Event creation and poster delivery do
not depend on it.

## 5. Rate limiter reliability

The limiter is a PostgreSQL table with an atomic upsert. Reliability choices:

- **Fail closed.** Any database error returns `allowed: false`. A limiter that
  failed open would turn a database outage into an authentication brute-force
  window.
- **No request-path blocking on cleanup.** Opportunistic pruning is fire-and-
  forget and runs on roughly 1% of successful calls. Cleanup failures are
  ignored.
- **Deterministic maintenance.** `npm run db:prune-rate-limits` deletes expired
  rows and prints the count. Run it daily or weekly.
- **Test isolation.** Opportunistic pruning is disabled under `NODE_ENV=test`;
  tests control their own fixtures.

The limiter table is not a source of business truth. If it is lost, the
application continues to work; active windows reset. That is an acceptable
trade-off for a fixed-window abuse control, but it should be included in
database backups with the rest of the schema.

## 6. Email reliability

Password recovery is the only email path.

- `EMAIL_ENABLED=false` is valid for local development. In development, the
  reset URL can be returned to the browser; in production, no token is ever
  returned.
- With `EMAIL_ENABLED=true`, `SMTP_HOST`, `EMAIL_FROM`, and credential pairs
  are validated at startup.
- SMTP connection, greeting, and socket timeouts are 10 s, 10 s, and 15 s.
- A delivery failure is caught, audited as `PASSWORD_RESET_FAILED`, and does
  **not** reveal whether the account exists. The caller receives the same
  generic response.
- The reset token is created before delivery. If delivery fails, the token
  remains valid but the user did not receive it; a subsequent request rotates
  the token.

Production implication: password recovery is unavailable without working SMTP.
The deployment checklist therefore requires a live delivery test.

## 7. Poster storage reliability

Two drivers are available:

| Driver  | Use case                               | Failure behavior                                                                 |
| ------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| `local` | Single instance with a durable volume  | Missing file returns `null`; unexpected filesystem errors become `STORAGE_ERROR` |
| `s3`    | Multi-instance or ephemeral filesystem | 15 s request timeout; 404 returns `null`; other failures become `STORAGE_ERROR`  |

Both drivers implement the same `PosterStorage` contract. Upload writes the
file first, then commits the database row; if the transaction fails, the new
file is deleted. If old-file cleanup fails after commit, the old row is already
gone and the result is an orphan file, not a broken reference.

The delivery route returns `404` for a missing object and a generic `500` for
an unexpected storage failure. A missing poster never breaks the event page;
the UI renders its fallback.

## 8. Build reliability

The production build initially failed with a Node heap out-of-memory error in
Next.js page-data workers. The host had 7,518 MB total RAM and only 663 MB free;
Next.js defaulted to 11 workers. A later attempt failed during the TypeScript
phase with a native out-of-memory stack trace even though `npm run typecheck`
passed independently. A PowerShell recursive deletion of `.next` also crashed
with `OutOfMemoryException`. The failures were environmental (worker/process
memory pressure plus a stale `.next` cache), not a TypeScript or application
error.

Mitigations:

- `next.config.ts` now defaults `experimental.cpus` to **2**, with
  `NEXT_BUILD_CPUS` as an override for larger CI runners.
- The Tesseract adapter is lazily imported, so build workers no longer evaluate
  the worker/WASM/language data.
- Delete a corrupt `.next` with `cmd /c "rmdir /s /q .next"` rather than a
  PowerShell recursive delete, then rebuild.
- A warm production build completed in **16.2 s**; an earlier cold build
  completed in **67.8 s** under memory pressure. The final 19 November
  verification cold build compiled in **11.7 s**, typechecked in **22.6 s**,
  and generated **42/42** static pages. Build times vary with host load.

Operational guidance:

- On a build agent with less than 4 GB free, keep `NEXT_BUILD_CPUS=2` or `1`.
- Do not run the production build while a development server, Docker Desktop,
  and other memory-heavy applications are competing for RAM.
- A build failure with exit code `3221226505` or "JavaScript heap out of
  memory" should be treated as a worker-memory issue first, not as a code
  failure. Re-run with `NEXT_BUILD_CPUS=1` and capture the full log before
  changing application code.
- If the TypeScript phase fails with a native stack trace but `npm run
typecheck` passes, clear `.next` and retry before investigating source types.

## 9. Error containment

The application has:

- A root `src/app/error.tsx` and `src/app/global-error.tsx`.
- Route-group error boundaries for student, club, college, and platform areas.
- Route-specific boundaries for attendance, feedback, and notifications.
- `not-found.tsx` for unknown routes.
- Loading states for the main dashboards and several sub-routes.

Domain errors are mapped to safe HTTP responses in
`src/server/http/responses.ts`. Unexpected errors do not return stack traces or
database messages to the browser.

## 10. Known single points of failure

| Component           | Failure impact                                                      | Mitigation                                                                                   |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| PostgreSQL          | Application reads/writes fail; health returns `503`; limiter denies | Managed backups/PITR, connection pool limits, restore runbook                                |
| Object storage (S3) | Poster upload/delivery fails; rest of the app continues             | Private bucket, versioning/lifecycle, provider status monitoring                             |
| SMTP provider       | Password reset delivery fails; login and app use continue           | Provider failover or manual admin reset procedure                                            |
| Single app instance | Full outage                                                         | Run at least two instances behind a load balancer for production; requires shared S3 storage |
| Local poster volume | Posters lost on instance replacement                                | Use `s3` for any multi-instance or ephemeral deployment                                      |

## 11. Verification summary

| Check                                  | Result                                                                                             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Health endpoint `200` and payload      | Passed in development and production builds; final warm request 42.5 ms with 3 ms database latency |
| Health endpoint `503` fault injection  | Not performed; documented gap                                                                      |
| OCR timeout/cooldown/stale-claim tests | Passed (9 Prompt 9 hardening tests)                                                                |
| Rate-limit fail-closed unit test       | Passed                                                                                             |
| Export limiter + audit end to end      | Passed (development and production builds)                                                         |
| Production build                       | Cold build passed; compiled 11.7 s, TypeScript 22.6 s, 42 static units                             |
| Full unit/integration suite            | 31 files / 235 tests passed in 105.25 s                                                            |
| Prompt 9 E2E                           | 5/5 in development (31.2 s) and 5/5 in production (11.1 s)                                         |
| Full Playwright regression             | **9/9 in one clean production-build run (1.4 min)**                                                |

The full Playwright suite is green in one run. The earlier development-server
failure was environmental memory pressure; it also exposed a production-only
CSP attribute-hash gap for `next/image`, which is now fixed. Details are in
`docs/PROMPT_9_VERIFICATION_REPORT.md`.

## 12. References

- `docs/PROMPT_9_OPERATIONS_RUNBOOK.md`
- `docs/PROMPT_9_BACKUP_AND_RECOVERY.md`
- `docs/PROMPT_9_DEPLOYMENT_GUIDE.md`
- `docs/PROMPT_9_PERFORMANCE_REPORT.md`
- `docs/PROMPT_9_VERIFICATION_REPORT.md`
- `.data/prompt9-test-verified.log`
- `.data/prompt9-build-final-prod.log`
- `.data/prompt9-e2e-prod-final.log`
- `src/app/api/health/route.ts`
- `src/server/auth/rate-limit.ts`
- `src/services/poster-ocr.ts`
- `src/server/ocr/tesseract-engine.ts`
- `src/server/storage/poster-storage.ts`
- `src/server/email/email-service.ts`
