# Production Hardening — Performance Report

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Local measurements complete; no production load test performed

This report records measured build, request, and database performance for the
Production Hardening verification environment. The numbers are real local measurements, not
capacity guarantees. The dataset is a development seed, so query timings show
plan shape and overhead, not production-scale throughput.

## 1. Environment

| Item                  | Value                                                       |
| --------------------- | ----------------------------------------------------------- |
| Host                  | Windows, 7,518 MB total RAM                                 |
| Free RAM during build | 663–903 MB; a game process used about 893 MB                |
| Node.js               | v24.13.0                                                    |
| npm                   | 11.6.2                                                      |
| Next.js               | 16.4.5 (Turbopack)                                          |
| React                 | 19                                                          |
| Prisma                | 7.10.1                                                      |
| Database              | PostgreSQL in Docker, port 5434                             |
| Build workers         | 2 (`experimental.cpus`, overridable with `NEXT_BUILD_CPUS`) |
| Browser               | Playwright Chromium                                         |

## 2. Production build

Command:

```powershell
npm run build
```

Result:

| Metric                | Earlier warm build | Earlier cold build |
| --------------------- | ------------------ | ------------------ |
| Build duration        | **16.2 s**         | **67.8 s**         |
| Compile               | 2.5 s              | 24.5 s             |
| TypeScript            | 5.1 s              | 28.2 s             |
| Static generation     | 42/42 in 517 ms    | 42/42 in 427 ms    |
| App routes            | all app routes     | all app routes     |
| Static assets on disk | **1.21 MB**        | **1.21 MB**        |
| Server bundle on disk | **36.28 MB**       | **36.29 MB**       |
| Build workers         | 2                  | 2                  |

Logs:

- `.data/production-build-final.log` — warm build, 16.2 s.
- `.data/production-build-verified-4.log` — cold build after clearing `.next`,
  57.1 s.
- `.data/production-build-final-prod.log` - earlier cold build, 67.8 s.

The earlier cold build was slower because `.next` was deleted and the host was
under load. The 16.2 s figure is a warm-cache build; it is not a
production-build guarantee. A later 19 November verification build, also after
deleting `.next`, compiled in 11.7 s, finished TypeScript in 22.6 s, and
generated 42/42 static pages in 1.035 s (`.data/production-final-build.log`). These
figures vary with host load. All builds produced the same 42 static-generation
units and the same application routes.

### Build memory incident

The first production builds failed during “Collecting page data” with:

```text
FATAL ERROR: NewSpace::EnsureCurrentCapacity Allocation failed - JavaScript heap out of memory
Next.js build worker exited with code: 3221226505
```

At the time, the host had 663 MB free of 7,518 MB and Next.js selected 11
page-data workers. The failure was a worker-concurrency memory exhaustion, not a
TypeScript or compile error. Two changes resolved it:

1. `next.config.ts` now defaults build workers to 2. Larger runners can set
   `NEXT_BUILD_CPUS` (for example, 4 or 8).
2. The Tesseract adapter is loaded dynamically, so build workers no longer
   evaluate the worker, WASM, and language data.

A later build attempt failed during the TypeScript phase with a native
out-of-memory stack trace even though `npm run typecheck` passed independently.
A PowerShell recursive deletion of `.next` also crashed with
`OutOfMemoryException`. Deleting `.next` with `cmd /c "rmdir /s /q .next"` and
rebuilding succeeded. This indicates a stale/corrupted `.next` cache plus host
memory pressure, not a source error.

The build is reproducible at 2 workers. A build on a host with more free memory
may finish faster with a higher `NEXT_BUILD_CPUS`, but that was not measured
here.

### Bundle interpretation

Next.js 16.4.5 does not print per-route “First Load JS” sizes in this build
output. The 1.21 MB static figure is the total on-disk size of `.next/static`,
not the compressed transfer size of a single page. The 36.28–36.29 MB server
figure includes the Node server, route modules, and Prisma client artifacts; it is not
the memory footprint of a running process.

## 3. Production-mode request timings

The production build was served with `npm start -- --port 3000` on the local
machine. Timings use PowerShell `Invoke-WebRequest`, which measures the complete
request from the client, including local loopback and server rendering.

### Health endpoint

| Run                 | Total    | Database probe |
| ------------------- | -------- | -------------- |
| Earlier 1           | 24.3 ms  | 2 ms           |
| Earlier 2           | 20.8 ms  | 2 ms           |
| Earlier 3           | 21.0 ms  | 1 ms           |
| Earlier 4           | 19.7 ms  | 2 ms           |
| Earlier 5           | 17.5 ms  | 1 ms           |
| Final 1 (cold pool) | 323.5 ms | not recorded   |
| Final 2 (warm)      | 42.5 ms  | 3 ms           |

The database probe is a single `SELECT 1` through the shared Prisma client. The
initial readiness probe before the timing run reported 327 ms of database
latency while the pool was cold; the warm payload reported 3 ms. The final run
was slower because the host was under load; the earlier run is kept for context.
The first final request includes connection-pool setup.

### Pages

| Path          | Earlier warm   | Final run          | Response size |
| ------------- | -------------- | ------------------ | ------------- |
| `/` (landing) | 137.2–137.6 ms | 395.9 ms, 338.9 ms | 161,528 bytes |
| `/login`      | 51.0–51.7 ms   | 122.5 ms           | 30,185 bytes  |
| `/robots.txt` | 15.8–16.3 ms   | 75.2 ms            | 97 bytes      |

The first request includes route compilation/cache warm-up in the production
server. The final run was slower because the host was under load; both runs are
local loopback measurements, not production latency.

These timings do **not** include TLS termination, network latency, CDN, or a
managed database. A production deployment should measure p50/p95/p99 at the
proxy and at the application.

## 4. Database query plans

The following are representative read shapes derived from the dashboard and
export services. They were run with `EXPLAIN (ANALYZE, BUFFERS)` against the
development seed. The seed is small (single-digit to low-hundreds of rows), so
sequential scans are expected and the absolute times are not production
capacity numbers.

| Query shape                                                          | Execution range (cold–warm runs) | Notes                                             |
| -------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| Discover: published upcoming events, tenant-scoped, ordered by start | **0.18–2.35 ms**                 | Small `events` scan; tenant filter applied        |
| Attendance roster: registrations + student profile + user            | **0.12–0.96 ms**                 | 2 registrations; index scan on `student_profiles` |
| Club analytics: per-event registration aggregate                     | **0.18–1.46 ms**                 | Small aggregate over the seeded club              |
| College audit log: tenant-scoped, newest first, limit 50             | **0.34–7.36 ms**                 | 274 audit rows; index scan, bounded by `LIMIT 50` |

The audit-log query has the widest variance at dev scale. In the latest run it
used `Index Scan Backward using "audit_logs_collegeId_createdAt_idx"`; an earlier
run spent more time sorting. On a larger dataset, confirm the plan still uses
that index and does not fall back to a sequential scan plus sort. The index
exists in `prisma/schema.prisma` (`@@index([collegeId, createdAt])`).

The range reflects two consecutive executions; the absolute times are smaller
than the run-to-run variance. These are plan-shape measurements, not production
capacity numbers.

### Index coverage relevant to these paths

- `events`: college/status/start indexes used by discover and dashboards.
- `event_registrations`: college/event/status index used by rosters and counts.
- `student_profiles`: college/roll-number unique index used by roster joins.
- `audit_logs`: `(collegeId, createdAt)` and `(actorUserId, createdAt)` indexes.
- `rate_limit_entries`: primary key on the HMAC key; expiry index for pruning.

The query plans are saved in `.data/query-plans.sql` and were run against the
local Docker database.

## 5. Test and verification timings

| Suite                                                   | Result                   | Duration               |
| ------------------------------------------------------- | ------------------------ | ---------------------- |
| Baseline unit/integration (before Production Hardening) | 28 files / 215 tests     | 86.28 s                |
| Final unit/integration                                  | **31 files / 235 tests** | **105.25 s**           |
| Hardening E2E, development server                       | 5/5                      | 31.2 s (historical)    |
| Hardening E2E, production build (final)                 | 5/5                      | 11.1 s (historical)    |
| Full Playwright regression, production                  | **9/9**                  | **1.4 min**            |
| Production Hardening hardening tests                    | 9 tests                  | Part of the full suite |
| SigV4 signing tests                                     | 3 tests                  | Part of the full suite |

The development E2E run is slower because each page is compiled on first
request by Turbopack; the production run reuses the prebuilt output. A clean
full Playwright regression against the production build passed 9/9 in 1.4 min.
The earlier 8/9 development run was retried after correcting a production-only
CSP attribute-hash gap for `next/image` inline styles; it was not an application
performance regression.

## 6. OCR performance

OCR throughput was **not** benchmarked. Tesseract is CPU-bound, loads a worker,
WASM, and English language data, and is unsuitable for an unbounded request
path. Production Hardening therefore treats OCR as a bounded best-effort operation:

- Lazy engine import.
- 12 s worker timeout with termination.
- 14 s deadline backstop.
- 60 s failure cooldown.
- 10 requests per 10 minutes per user.

A production deployment that expects heavy OCR use should measure p95 OCR
latency and CPU saturation, and may move OCR to a background worker. That is a
future architecture change, not part of Production Hardening.

## 7. Capacity and scaling notes

- The application is stateless except for local poster storage. With
  `POSTER_STORAGE_DRIVER=s3`, multiple app instances can share posters.
- The database connection pool defaults to 10 per instance. Size the database
  connection limit for `instances × pool + migrations + monitoring`.
- The rate limiter is database-backed and shared across instances.
- Static assets should be served through a CDN or the hosting platform's edge
  cache in production.
- No load test (k6, Artillery, or equivalent) was run. The endpoint and query
  numbers above are single-request local measurements. A pre-scale load test is
  a documented residual gap, not a completed verification.

## 8. Performance-related decisions

| Decision                         | Reason                                                           |
| -------------------------------- | ---------------------------------------------------------------- |
| Default 2 build workers          | Prevent reproducible OOM on a 7.5 GB host; override on larger CI |
| Lazy OCR import                  | Keep Tesseract out of build workers and non-OCR routes           |
| Database-backed rate limits      | Correct across instances; small indexed upsert                   |
| No CDN dependency in code        | Deployment can add a CDN without application changes             |
| No client-side analytics bundle  | Analytics are database-derived and server-rendered               |
| `no-store` on exports and health | Correctness and privacy take precedence over caching             |

## 9. Residual performance risks

| Risk                                        | Status                                     | Action                                                                        |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| No production load test                     | Open                                       | Run a representative load test before scaling beyond the first instance       |
| Full E2E suite flake under memory pressure  | Resolved 19 Nov 2026                       | Production-build run passed 9/9; retain CI retry policy for constrained hosts |
| Build sensitivity to free RAM and `.next`   | Open                                       | Keep 2 workers; clear `.next` with `cmd` if a build worker crashes            |
| Audit log growth                            | Open                                       | Monitor table size; define retention with the college/platform policy         |
| OCR CPU contention                          | Accepted for now                           | Bounded and rate-limited; move to a worker if usage grows                     |
| Large CSV exports                           | Tenant-scoped; no fixed attendance row cap | Monitor response time and memory; move to streaming if colleges grow large    |
| Cold start on serverless                    | Not applicable to the current Node server  | If deployed serverless, measure cold starts and Prisma connection behavior    |
| Local filesystem storage on ephemeral hosts | Avoided by S3 driver                       | Use `s3` for any ephemeral or multi-instance deployment                       |

## 10. References

- `docs/PRODUCTION_VERIFICATION_REPORT.md`
- `docs/RELIABILITY_REPORT.md`
- `docs/PRODUCTION_ARCHITECTURE.md`
- `next.config.ts`
- `prisma/schema.prisma`
- `.data/production-build-final.log`
- `.data/production-build-verified-4.log`
- `.data/production-build-final-prod.log`
- `.data/production-e2e-full.log`
- `.data/intelligence-ocr.log`
- `.data/production-e2e-prod-final.log`
- `.data/query-plans.sql`
- `.data/production-query-plans-final.log`
