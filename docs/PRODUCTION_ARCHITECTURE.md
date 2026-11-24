# Production Hardening — Production Architecture

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Proposed production topology; not deployed

This document describes the architecture the application is prepared for. It is
a deployment target, not a record of a live environment. No production
infrastructure has been provisioned.

## 1. Principles

- Preserve the existing Next.js App Router, React Server Components, Prisma,
  and Better Auth architecture.
- Keep the application stateless where possible; put durable state in
  PostgreSQL and object storage.
- Keep every tenant-scoped query enforced in the application and backed by
  composite foreign keys.
- Terminate TLS at a trusted proxy and forward only the headers the app needs.
- Prefer free or already-owned infrastructure until the owner approves a paid
  service.
- Do not add a queue, cache, or microservice unless a measured need appears.

## 2. Logical topology

```text
                       ┌─────────────────────────────┐
                       │        DNS + TLS proxy      │
                       │  (hosting edge, Caddy, or   │
                       │   nginx; HSTS, HTTP → HTTPS)│
                       └──────────────┬──────────────┘
                                      │ HTTPS
                       ┌──────────────▼──────────────┐
                       │   Next.js application        │
                       │   Node.js runtime            │
                       │   - RSC pages + server       │
                       │     actions                  │
                       │   - route handlers           │
                       │   - Better Auth sessions     │
                       │   - Prisma client            │
                       └───────┬──────────────┬───────┘
                               │              │
                 ┌─────────────▼───┐    ┌─────▼────────────────┐
                 │  PostgreSQL     │    │ S3-compatible object │
                 │  - app data     │    │ storage (posters)    │
                 │  - sessions     │    │ private bucket       │
                 │  - audit logs   │    └──────────────────────┘
                 │  - rate limits  │
                 └─────────────────┘
                               │
                 ┌─────────────▼───┐
                 │  SMTP provider  │
                 │  password reset │
                 └─────────────────┘

                 ┌─────────────────┐
                 │  Monitoring     │
                 │  health, logs,  │
                 │  uptime alerts  │
                 └─────────────────┘
```

## 3. Components

### 3.1 Edge / reverse proxy

Responsibilities:

- Terminate TLS with a valid certificate for the production domain.
- Redirect HTTP to HTTPS.
- Set or preserve `X-Forwarded-For` and `X-Forwarded-Proto` correctly.
- Enforce request body and header size limits at the edge as a second line of
  defense.
- Optionally provide WAF, bot filtering, and volumetric DDoS protection.
- Serve cached static assets if the platform does not already do so.

The application also sends HSTS, CSP, `X-Frame-Options`, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`, COOP, and CORP. The edge must not strip
these headers.

### 3.2 Next.js application

- Next.js 16.4.5 App Router with React 19 Server Components.
- Node.js runtime for database, storage, and OCR routes.
- Server actions for authenticated mutations; no public auth API route.
- `src/proxy.ts` generates the per-request nonce CSP.
- Prisma 7 client with a bounded connection pool.
- Better Auth sessions stored in PostgreSQL; cookies are HTTP-only, secure in
  production, and same-site.
- Poster OCR runs synchronously and is bounded; there is no background worker.

The app is stateless for session and business data. Local poster storage makes
it stateful; use S3 for any multi-instance deployment.

### 3.3 PostgreSQL

Stores:

- Colleges, users, student profiles, clubs, memberships.
- Events, registrations, attendance, feedback.
- Posters metadata (binary content is in object storage).
- Notifications.
- Sessions and password-reset tokens.
- Audit logs and rate-limit counters.

Requirements:

- PostgreSQL 15 or newer (the local verification uses the project's Docker
  image; confirm the provider version).
- TLS required for hosted databases (`DATABASE_SSL=true` where needed).
- Pooled connection string for the app (`DATABASE_URL`); direct connection for
  migrations (`DIRECT_URL`).
- Automated backups and, if the provider supports it, point-in-time recovery.
- Private network access; no public database port.

### 3.4 Object storage

- Private S3-compatible bucket.
- No public bucket policy, no public object ACLs.
- Server-side encryption at rest (provider default is acceptable).
- Optional versioning and a lifecycle rule for noncurrent versions.
- Access only through the application's authenticated poster route.
- `S3_FORCE_PATH_STYLE=true` for MinIO and most non-AWS providers;
  `false` for AWS virtual-hosted-style endpoints if preferred.

Poster objects are addressed by UUID keys with a `.jpg`, `.png`, or `.webp`
extension. The application validates the bytes before upload and serves them
with `nosniff`, `CORP: same-origin`, and `Cache-Control: private, no-store`.

### 3.5 SMTP

- Used only for password-reset delivery.
- Requires `EMAIL_ENABLED=true`, `SMTP_HOST`, `EMAIL_FROM`, and credentials.
- Use a provider with a free tier or an existing organizational relay.
- Authenticate with an app password or secret-manager value; never commit it.
- Verify SPF, DKIM, and DMARC for the sending domain before launch.

### 3.6 Monitoring

Minimum:

- HTTPS uptime check on `/api/health` every 30–60 s.
- Alert on `503`, timeout, or three consecutive failures.
- Application log aggregation with secret redaction.
- Database storage, connections, and slow-query alerts.
- Object storage error-rate and latency alerts.
- SMTP failure alerts (password-reset failures are audited).

Optional, if already available: OpenTelemetry traces, Sentry-compatible error
reporting, and a status page.

## 4. Request flows

### 4.1 Page request

```text
Browser → TLS proxy → Next.js RSC render
        → getCurrentUser() (session + fresh actor reload)
        → tenant-scoped Prisma query
        → HTML streamed to browser
```

### 4.2 Authenticated mutation

```text
Browser form → server action
             → origin/session check
             → rate limit (database)
             → Zod validation
             → authorization (role + tenant + ownership)
             → transaction + audit row
             → revalidatePath / redirect
```

### 4.3 Export download

```text
Browser → GET /api/exports/...
        → session check
        → rate limit (exportDownloadUser)
        → tenant-scoped data query
        → EXPORT_DOWNLOADED audit row
        → CSV with UTF-8 BOM, CRLF, formula escaping
        → no-store download response
```

### 4.4 Poster upload

```text
Browser → server action
        → auth + club manager check + rate limit
        → content-signature validation
        → storage.put(generated key)
        → transaction: poster row + audit
        → old file cleanup after commit
```

### 4.5 OCR

```text
Browser → OCR action
        → auth + ownership + rate limit
        → per-process concurrency slot (2 active, 8 queued, 20 s wait)
        → lazy import Tesseract adapter
        → worker with 12 s timeout and abort support
        → bounded field extraction
        → OCR status persisted
```

## 5. Trust boundaries

| Boundary             | Control                                                                                |
| -------------------- | -------------------------------------------------------------------------------------- |
| Browser → edge       | TLS, HSTS, secure cookies                                                              |
| Edge → app           | Trusted proxy headers; app validates session server-side                               |
| App → database       | Private network, TLS, least-privilege database user, pooled connection                 |
| App → object storage | HTTPS, SigV4, private bucket, 15 s timeout                                             |
| App → SMTP           | TLS where supported, app password, no token logging                                    |
| Tenant → tenant      | App-layer scoping plus composite foreign keys; no client-supplied tenant ID is trusted |
| Admin → user data    | Role checks, audit logging, redaction                                                  |
| Public → health      | Minimal payload; no secrets                                                            |

## 6. Deployment shapes

### Shape A — single VM (lowest cost)

- One application instance on a VM or home server.
- PostgreSQL on the same host or a managed free-tier database.
- `POSTER_STORAGE_DRIVER=local` with a durable volume outside the app directory.
- Caddy or nginx for TLS.
- Suitable for a pilot with low availability requirements.
- Risks: single point of failure; local posters tied to the volume.

### Shape B — managed platform + managed data (recommended for production)

- One or more app instances on a Node-capable platform.
- Managed PostgreSQL with backups/PITR.
- S3-compatible object storage.
- Managed SMTP.
- `POSTER_STORAGE_DRIVER=s3`.
- Suitable for multi-instance and zero-downtime deploys.
- Requires paid or free-tier service choices and owner approval.

### Shape C — container orchestrator

- Container image of the Next.js standalone output.
- Two or more replicas behind a load balancer.
- Managed PostgreSQL and S3.
- External secret manager.
- More operational overhead than Shape B; only justified by scale or existing
  platform standards.

No shape is approved or provisioned yet. The deployment guide describes the
steps common to all shapes.

## 7. Data protection

- Passwords: Argon2id hashes only.
- Sessions: database-backed, HTTP-only cookies, secure in production.
- Reset tokens: random 32-byte tokens, stored as hashes, single use, expiring.
- Posters: content-validated images; private storage; authenticated delivery.
- Exports: tenant-scoped; `no-store`; audited; formula-escaped.
- Audit logs: no passwords, tokens, or export contents; actor and tenant IDs
  retained for accountability.
- Logs: no connection strings, secrets, or query parameters by default.

## 8. Scaling path

1. Start with one app instance, managed PostgreSQL, S3, and SMTP.
2. Move static assets to a CDN if the platform does not cache them.
3. Add a second app instance behind the load balancer; keep sessions and rate
   limits in PostgreSQL and posters in S3.
4. Increase the database pool and instance size based on measured p95 latency
   and connection saturation.
5. If OCR becomes a bottleneck, move it to a background worker with a queue.
   This is a future change and is not implemented.
6. If audit volume grows, define retention and partition/archive the table.

## 9. Explicit non-goals

- No microservice split.
- No Redis requirement.
- No Kubernetes requirement.
- No public poster bucket.
- No client-side analytics pipeline.
- No background job system in Production Hardening.
- No change to the role model or tenant isolation design.

## 10. References

- `docs/DEPLOYMENT_GUIDE.md`
- `docs/ENVIRONMENT_REFERENCE.md`
- `docs/BACKUP_AND_RECOVERY.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/SECURITY_HARDENING.md`
- `docs/poster-storage.md`
