# CampusPulse

CampusPulse is a multi-college campus event discovery and moderation platform.
The repository contains the verified landing page, a responsive authentication
surface, a multi-tenant PostgreSQL schema, database-backed sessions, server-side
RBAC/tenant authorization, integration tests, and a safe fictional development
seed.

Prompt 5 is implemented through four role-specific dashboards backed by real
PostgreSQL data. Prompt 6 adds event operations: poster upload/replacement/
removal with a server-only local storage adapter, authenticated poster delivery,
transactional in-app notifications for moderation and registration events, and
poster/lifecycle audit coverage. Prompt 7 adds local Tesseract.js poster OCR with
human review, deterministic student recommendations, advisory same-college
duplicate review, and advisory schedule-conflict warnings with server-side
revalidation. Prompt 8 connects QR attendance, post-event feedback, calendar
downloads, engagement analytics, notification preferences, and authorized CSV
exports to the role dashboards. Prompt 9 hardens the existing system for
production: per-user rate limits, export audit rows, bounded OCR, a health
endpoint, an S3-compatible poster storage adapter, validated environment
configuration, accessibility fixes, and deployment/operations documentation.
Prompt 10 completes the submission pass: the required “CampusPulse — Too Many
Posters, Too Little Signal.” landing message, an accessible four-role product
preview, grouped dashboard navigation, editorial metric cards, stronger role
focus panels, a designed poster fallback, responsive fixes down to 360 px, new
screenshots, and final submission/verification documents. Public business APIs,
email/push/SMS notification delivery, two-way calendar sync, live production
deployment, and PostgreSQL RLS remain future work. The S3 adapter and SMTP path
are implemented but have not been exercised against live services.

The project is published at
<https://github.com/Piyush-singh17200/CampusPulse>.

## Current status

Implemented and verified in this phase:

- Responsive, accessible CampusPulse landing page with all 11 required sections.
- Next.js 16 App Router, strict TypeScript, ESLint, Prettier, and production build.
- PostgreSQL 17 Docker service on host port `5434`.
- Prisma schema with 27 models, enums, composite tenant foreign keys, indexes,
  timestamps, and deliberate deletion behavior.
- Eight applied migrations: the initial schema, the event audit enum extension,
  the additive auth/session/RBAC migration, the additive dashboard
  saved-event/audit migration, the Prompt 6 poster audit enum migration, the
  Prompt 7 event-intelligence migration, the Prompt 8 attendance/feedback/
  notification-preference migration, and the Prompt 9 export-download audit
  enum migration.
- Central database configuration, pooling, hot-reload singleton, health check,
  test-database guards, tenant helpers, domain errors, transaction retries, and
  audit redaction.
- Event lifecycle, registration, club-decision, user-role, authorization, and
  validation services.
- Better Auth 1.7.18 email/password authentication with database sessions,
  Argon2id password hashing, HttpOnly/SameSite/Secure cookies, login/logout, and
  disabled-account rejection.
- Validated student registration, generic login errors, password recovery with
  hash-only single-use reset tokens, PostgreSQL-backed rate limiting, and
  explicit same-origin/CSRF checks.
- Trusted `AuthenticatedActor` service signatures. Identity, role, college, and
  club memberships are loaded from the verified session and PostgreSQL, never
  accepted from browser payloads.
- Login, registration, forgot-password, reset-password, unauthorized,
  account-disabled, and minimal account-home screens.
- Student, club administrator, college administrator, and platform administrator
  dashboards with distinct navigation, real database metrics, filters,
  pagination, loading/empty/error states, and responsive layouts.
- Server-only dashboard query functions, route-level role guards, and Server
  Actions that call the existing trusted-actor domain services.
- Persistent student saved events with composite tenant foreign keys,
  idempotent save/unsave behavior, and audit entries.
- JPEG/PNG/WebP poster upload, replacement, and removal with content-based
  validation, 5 MB and dimension limits, server-generated keys, accessible
  previews, safe broken-image handling, and a local server-only storage adapter.
- Authenticated, tenant-aware poster delivery with `private, no-store`,
  `nosniff`, and same-origin response headers. Unpublished posters are limited to
  the owning club manager, college administrators, and platform administrators.
- Transactional in-app notifications for event approval, rejection with reason,
  cancellation, and registration confirmation/cancellation. Notifications are
  written in the same transaction as the state change.
- Poster lifecycle and replacement/removal audit actions (`POSTER_UPLOADED`,
  `POSTER_REPLACED`, `POSTER_REMOVED`) alongside the existing event and
  registration audit trail.
- CLI-only super-admin bootstrap with no public endpoint and no default password.
- Local, explicit poster OCR using bundled Tesseract.js English traineddata,
  with server-only processing, duplicate-request claims, safe failure state, and
  per-field human review before values reach the normal event update path.
- Deterministic student recommendations from explicit interests, category
  affinity, timing, and popularity, with honest explanations and empty/error
  fallbacks.
- Advisory same-college duplicate detection with stored confidence/reasons and
  confirm/dismiss review. Review never merges, rejects, cancels, or deletes an
  event.
- Advisory schedule-conflict warnings using strict interval overlap, including
  server-side revalidation and audit metadata during registration.
- Event-bound QR attendance credentials, a browser camera scanner with a manual
  token fallback, a reasoned attendance correction path, check-in timestamps,
  and an authorized attendance register at `/club/attendance`.
- Student feedback for attended completed events, a 30-day submission/edit
  window, read-only club review, and college-admin moderation that preserves the
  original response and audit history.
- Authenticated ICS downloads for a single event, registered events, and saved
  events. Calendar files are download-only; there is no two-way sync.
- Database-derived club, college, and platform analytics with date/event/club/
  category/status filters, event and registration trends, attendance and
  completion rates, rating distributions, low-attendance events, and per-event
  breakdowns.
- Authorized CSV exports for club attendance, club analytics, college analytics,
  and platform analytics with UTF-8 BOM, CRLF records, spreadsheet-formula
  protection, and tenant-scoped rows.
- A paginated notification center with unread/type filters, per-type counts,
  safe deep links, read state, and database-backed in-app preferences for
  registration, attendance, and feedback categories.
- Isolated Vitest integration suite against `campuspulse_test` with 235 passing
  tests across 31 files, including Prompt 8 attendance, feedback, ICS, CSV,
  analytics, notifications, poster validation/storage/access/cleanup, Prompt 9
  rate limits, export audit, OCR timeout/cooldown, health payload safety, and
  SigV4 signing, notification scoping, concurrency, tenant, lifecycle, auth,
  session, reset, rate-limit, CSRF, RBAC, dashboard authorization, filtering,
  pagination, audit, and security tests.
- Playwright workflow coverage for create → preview → submit → approve → student
  view → register → club registration list → cancel → replace poster →
  access-control checks → remove → responsive screenshots, plus Prompt 7 OCR,
  recommendations, duplicate review, and conflict warnings.
- Prompt 8 Playwright workflow covers attendance QR/manual check-in, feedback
  submission and moderation, single/registered/saved ICS downloads, all four
  CSV exports, club/college/platform analytics, notification filters and
  preferences, and 390 px attendance/notification layouts.
- Prompt 9 Playwright workflow covers health/readiness, security headers,
  unauthenticated export/calendar/poster `401`s, export rate limiting and
  audit, skip navigation, labeled login inputs, and 375/768/1440 px responsive
  layouts.
- Prompt 10 landing page with the required headline, interactive
  Student/Club/College/Platform preview, real CTAs, and clearly labelled
  illustrative data.
- Prompt 10 dashboard polish: grouped navigation, desktop breadcrumbs, mobile
  focus management, editorial metric cards, role-specific focus panels,
  notification/interest/schedule surfaces, and a designed poster-pending
  fallback.
- Prompt 10 responsive evidence: 27 screenshots and a 50-route audit at 360,
  390, 768, 1024, 1280, and 1440 px, with 0 console errors, 0 non-success
  routes, and 0 horizontal-overflow failures.
- Prompt 10 submission documents: feature matrix, submission guide, demo
  script, and final verification report.
- Idempotent, fictional, development-only seed with curated demo
  notifications and predictable college-local event times.
- Design-system, database, authentication, dashboard, event-operations,
  event-intelligence, attendance-feedback-analytics, poster-storage, security,
  future-screen, and Prompt 9 production-readiness docs (audit, security,
  reliability, performance, accessibility, architecture, deployment,
  environment, backup/recovery, operations, and final verification).

Intentionally deferred:

- Public business APIs and any unauthenticated business endpoint.
- Semantic duplicate detection and external recommendation or LLM services.
- Two-way calendar synchronization, calendar subscriptions, and reminder
  delivery. ICS files are authenticated downloads only.
- Email/push/SMS notification delivery. Notifications are in-app only.
  Password-reset SMTP is configurable, but live delivery has not been verified.
- Live S3 object-storage verification, CDN delivery, and poster malware
  scanning. The S3-compatible adapter is implemented but has not been exercised
  against a live bucket.
- Production deployment, secret-manager integration, load testing, a restore
  drill, and a penetration test. HSTS and the other security headers are
  implemented.
- PostgreSQL RLS. Tenant isolation is currently application-layer scoping plus
  composite foreign keys. See `docs/database.md` and
  `docs/authentication.md`.

## Requirements

- Windows 10/11 with PowerShell (the project also runs on macOS/Linux).
- Node.js `>=20.19.0` (the repository has `.nvmrc`).
- npm (ships with Node).
- Docker Desktop with Docker Compose.
- Git (optional for local development; clone the published repository or use
  the existing checkout).

## Quick start on Windows

```powershell
cd C:\Users\singh\OneDrive\Desktop\CAMPUSPULSE

# 1. Install exactly the locked dependencies.
npm ci

# 2. Create the local environment file.
Copy-Item .env.example .env.local
# Generate a unique auth secret and put it in BETTER_AUTH_SECRET:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Start PostgreSQL in Docker.
docker compose up -d
docker compose ps

# 4. Validate and prepare Prisma.
npm run db:validate
npm run db:generate
npm run db:migrate:deploy
npx prisma migrate status

# 5. Check the connection and load fictional development data.
npm run db:health
npm run db:seed

# 6. Start the app.
npm run dev
# Open http://localhost:3000
```

The seed command is intentionally explicit. It refuses production, the test
database, and remote hosts. It can be run repeatedly without creating duplicate
records.

## Authentication quick start

The development seed creates fictional users and roles, but it deliberately does
**not** create passwords. To exercise the auth flow locally:

1. Open `http://localhost:3000/register`.
2. Create a student account with a development-only password.
3. Optionally promote an existing account to platform administrator:

```powershell
npm run auth:bootstrap-super-admin -- existing-user@example.com --confirm-super-admin
```

The bootstrap command requires an existing active account, an explicit
confirmation flag, and a local/trusted environment. It never creates a password,
default credential, or public endpoint. It revokes the promoted user's sessions,
so sign in again afterward. See `docs/authentication.md`.

### Prepared local demo accounts

The prepared local demo database used for the Prompt 10 screenshots has four
credentialed accounts. All use the local-only password `CampusPulse!2026`:

| Role                   | Email                                    |
| ---------------------- | ---------------------------------------- |
| Student                | `isha.rao@campuspulse.example`           |
| Club administrator     | `robotics.president@campuspulse.example` |
| College administrator  | `northfield.admin@campuspulse.example`   |
| Platform administrator | `platform.admin@campuspulse.example`     |

The seed creates the fictional users but intentionally does not create
passwords. A fresh database therefore requires account creation and role
provisioning before these exact credentials work. Never reuse these credentials
in a deployed environment. See [`docs/SUBMISSION_GUIDE.md`](docs/SUBMISSION_GUIDE.md).

## PostgreSQL in Docker

`docker-compose.yml` defines:

| Setting       | Value                                    |
| ------------- | ---------------------------------------- |
| Image         | `postgres:17-alpine`                     |
| Container     | `campuspulse-postgres`                   |
| Host port     | `5434` → container `5432`                |
| Database      | `campuspulse`                            |
| User/password | local-only `campuspulse` / `campuspulse` |
| Volume        | `campuspulse_postgres_data`              |

Port `5434` is intentional: a native PostgreSQL install or another project may
already own `5432`/`5433`. Do not change the port without updating
`DATABASE_URL`, `DIRECT_URL`, and `TEST_DATABASE_URL`.

Useful commands:

```powershell
docker compose up -d
docker compose ps
docker compose logs -f postgres
docker compose stop
docker compose down
```

`docker compose down` keeps the named volume. `docker compose down -v` deletes
the local database volume and is destructive; use it only on a disposable local
environment.

## Environment variables

Copy `.env.example` to `.env.local`. `.env.local` is ignored by Git.

| Variable                            | Required | Purpose                                                                   |
| ----------------------------------- | -------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                      | yes      | Runtime PostgreSQL connection; use a pooled URL in a hosted environment   |
| `DIRECT_URL`                        | yes      | Prisma CLI/migration connection; use a direct URL in a hosted environment |
| `TEST_DATABASE_URL`                 | tests    | Separate URL whose database name is exactly `campuspulse_test`            |
| `NEXT_PUBLIC_APP_URL`               | yes      | Public origin used for metadata; never put secrets in `NEXT_PUBLIC_*`     |
| `BETTER_AUTH_SECRET`                | yes      | 32+ byte random secret used by Better Auth and default HMAC lookup keys   |
| `BETTER_AUTH_URL`                   | yes      | Auth origin; use HTTPS in production                                      |
| `RATE_LIMIT_SECRET`                 | no       | Separate 32+ byte key for HMAC rate-limit lookup keys                     |
| `EMAIL_ENABLED`                     | no       | `true` enables SMTP password-reset delivery                               |
| `SMTP_HOST`                         | email    | Required when `EMAIL_ENABLED=true`                                        |
| `SMTP_PORT`                         | no       | SMTP port, default `587`                                                  |
| `SMTP_SECURE`                       | no       | `true` for implicit TLS; usually `false` with STARTTLS on port 587        |
| `SMTP_USER` / `SMTP_PASSWORD`       | email    | Optional paired SMTP credentials; both or neither                         |
| `EMAIL_FROM`                        | email    | Sender address, required when email is enabled                            |
| `POSTER_STORAGE_DRIVER`             | no       | `local` (default) or `s3`; use `s3` for multi-instance deployments        |
| `POSTER_STORAGE_DIR`                | no       | Local poster storage root; default `.data/posters`                        |
| `S3_ENDPOINT` / `S3_REGION`         | s3       | HTTPS S3-compatible endpoint and signing region                           |
| `S3_BUCKET` / `S3_ACCESS_KEY_ID`    | s3       | Private bucket and access key (least privilege)                           |
| `S3_SECRET_ACCESS_KEY`              | s3       | Secret key; never commit or log                                           |
| `S3_SESSION_TOKEN`                  | no       | Session token for temporary AWS/STS or role credentials                   |
| `S3_ALLOW_INSECURE`                 | no       | Non-local HTTP only outside production; default `false`                   |
| `S3_FORCE_PATH_STYLE` / `S3_PREFIX` | no       | Path-style URLs (default `true`) and optional safe key prefix             |
| `DATABASE_POOL_MAX`                 | no       | Pool size, default `10`                                                   |
| `DATABASE_CONNECTION_TIMEOUT_MS`    | no       | Connection timeout, default `5000`                                        |
| `DATABASE_IDLE_TIMEOUT_MS`          | no       | Idle timeout, default `30000`                                             |
| `DATABASE_SSL`                      | no       | `true` for a TLS-required hosted database                                 |
| `DATABASE_LOG_QUERIES`              | no       | Query logging; never enable in production                                 |
| `TRUST_PROXY_HEADERS`               | no       | Opt in only behind a trusted reverse proxy; default `false`               |
| `TRUSTED_PROXY_HOPS`                | no       | Number of trusted proxy hops used to select the client IP; default `1`    |

The app validates required values at startup. Errors name the invalid field but
never print credential values. The database layer additionally validates the
pool settings and refuses an unsafe test database.

Production notes:

- Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to the same HTTPS origin.
- Generate distinct secrets from a secret manager; never reuse local values.
- Production auth cookies always include `Secure`; serve the app over HTTPS.
- Production password recovery requires SMTP. If `EMAIL_ENABLED=false`,
  production never returns or logs a reset token, so recovery is unavailable.
- Only set `TRUST_PROXY_HEADERS=true` when a trusted reverse proxy strips
  client-supplied forwarding headers. Set `TRUSTED_PROXY_HOPS` to the real number
  of proxies; otherwise the client IP is reported as `unknown`.
- Do not place SMTP passwords or auth secrets in `NEXT_PUBLIC_*` variables.

## Prisma commands

| Command                              | Purpose                                          |
| ------------------------------------ | ------------------------------------------------ |
| `npm run db:validate`                | Validate the Prisma schema                       |
| `npm run db:generate`                | Regenerate the Prisma client                     |
| `npm run db:migrate`                 | Create/apply a development migration             |
| `npm run db:migrate:deploy`          | Apply existing migrations (CI/production-style)  |
| `npx prisma migrate status`          | Show applied/pending migrations                  |
| `npm run db:health`                  | Query the configured database and report latency |
| `npm run db:seed`                    | Load the guarded fictional development seed      |
| `npm run db:studio`                  | Open Prisma Studio                               |
| `npm run db:format`                  | Format the schema                                |
| `npm run auth:bootstrap-super-admin` | Promote an existing active account via CLI       |

The Prisma CLI loads `.env.local` and uses `DIRECT_URL`; the Next.js runtime uses
`DATABASE_URL`. Locally both point at `localhost:5434`.

## Development seed

`npm run db:seed` runs `prisma/seed.ts` with
`--confirm-development-seed`. It seeds:

- Two fictional colleges: Northfield University and Lakeview Institute.
- Fictional students, college administrators, club administrators, and a
  platform administrator.
- Active and pending clubs with memberships.
- Categories and interests.
- Ten events in draft, pending, published, rejected, cancelled, and completed
  states, with predictable Asia/Kolkata event times.
- Fictional registrations and registrations in attended/no-show/cancelled states.
- Four curated in-app notifications for student, club, and college demo roles.

The seed uses deterministic emails/slugs and upserts, so rerunning it does not
create duplicates. It does not create credentials, passwords, reset tokens, or
weak production secrets. Demo accounts use `@campuspulse.example` addresses and
are for local development only.

Safe reset guidance for a **disposable local database only**:

```powershell
# This deletes local development data and reapplies migrations.
npx prisma migrate reset

# Then reseed.
npm run db:seed
```

Never run `prisma migrate reset` or the seed against a production database.
`docker compose down -v` is even more destructive because it removes the volume.

## Tests

```powershell
npm test          # one run
npm run test:watch
npm run test:db    # alias for the database integration suite
```

The test runner:

1. Loads `.env.local`.
2. Requires `TEST_DATABASE_URL`.
3. Refuses any database whose name is not exactly `campuspulse_test`.
4. Refuses non-local test hosts.
5. Creates `campuspulse_test` if needed.
6. Runs `prisma migrate deploy` against that database.
7. Rewrites the application `DATABASE_URL` to the test URL before importing the
   Prisma client.
8. Truncates only tables in `campuspulse_test` between test files.

The suite covers database initialization/reuse/failure handling, tenant
relationships and cross-college FK rejection, registration success/duplicates/
deadlines/capacity/cancellation, event lifecycle and audit, poster content
validation, poster storage keys/path traversal, poster upload/replacement/
removal/access control/storage failure/cleanup, notification scoping and retry
guards, Prompt 8 QR attendance and corrections, feedback submission/moderation,
ICS escaping and download scopes, CSV BOM/CRLF/formula protection, analytics
aggregates and filters, notification preferences/read state, club/role
administration, audit redaction/rollback, security boundaries, concurrent
capacity/duplicate races, student registration, Argon2id hashes, Better Auth
sessions, logout/expiry/deleted sessions, disabled accounts, reset-token
hashing, expiry/single use/session revocation, PostgreSQL rate limits,
CSRF/origin checks, RBAC helpers, role-change session revocation, CLI
super-admin bootstrap, Prompt 9 rate limits, export audit, OCR timeouts, health
payload safety, and SigV4 signing. Tests run sequentially
(`fileParallelism: false`, `maxWorkers: 1`) so database resets are
deterministic. The current suite has 31 test files and 235 passing tests.

### Browser workflow tests

```powershell
npm run test:e2e
```

Playwright uses `playwright.config.ts` and Chromium. It starts `npm run dev` on
`http://localhost:3000` when no server is running, or reuses an existing
development server. Do not run it against a stale production `next start`
process. The workflow uses the seeded demo accounts and creates a new test event
in the **development** database; it does not reset or truncate the database.
Clear `rate_limit_entries` or wait for the login window if repeated runs hit
“Too many attempts.” Screenshots are written to `docs/screenshots/prompt-6/`,
`docs/screenshots/prompt-7/`, and `docs/screenshots/prompt-8/`.

## Development and production commands

```powershell
npm run dev       # Next.js development server
npm run typecheck # tsc --noEmit
npm run lint      # ESLint
npm run format    # Prettier write
npm run format:check
npm run build     # production build (runs prisma generate first)
npm run start     # serve the production build
```

Before rebuilding, stop any stale server already listening on port 3000.
`npm run build` regenerates the Prisma client. `npm run start` does not run
migrations or the seed automatically. A production deployment must run
`prisma migrate deploy` as a separate release step.

## Project structure

```text
prisma/
  schema.prisma                 27-model multi-tenant + auth schema
  migrations/                   applied SQL migrations
  seed.ts                       guarded fictional development seed
scripts/
  bootstrap-super-admin.ts      CLI-only super-admin promotion
  check-db.ts                   database connection health check
src/
  app/                          App Router pages, auth pages, dashboard routes
  app/api/posters/              authenticated poster delivery route
  app/api/calendar/             authenticated single/registered/saved ICS routes
  app/api/exports/              authorized club/college/platform CSV routes
  app/student/                  student dashboard routes
  app/club/                     club administrator routes
  app/college/                  college administrator routes
  app/platform/                 platform administrator routes
  components/                   brand, layout, auth, dashboard, and UI primitives
  features/auth/                auth Server Actions and screens
  features/dashboards/          dashboard Server Actions and forms
  features/landing/             verified 11-section landing page
  config/                       environment, site, and security config
  server/auth/                  Better Auth, sessions, RBAC, page guards, audit
  server/dashboards/            server-only dashboard access and query layer
  server/db/                    client, config, tenant, audit, notifications
  server/email/                 optional SMTP delivery
  server/posters/               content-based poster validation
  server/ocr/                   deterministic extraction + local Tesseract engine
  server/storage/               server-only poster storage interface + local adapter
  server/exports/               CSV serialization and formula-injection protection
  server/http/                  safe download response helpers
  server/errors.ts              domain error types
  services/                     event, registration, attendance, feedback, calendar,
                                analytics, notification, poster, club, user domains
  generated/prisma/             generated client (not hand-edited)
tests/
  global-setup.ts               test DB creation + migrate deploy
  setup.ts                      test URL/env guard
  helpers/                      factories, auth helpers, image fixtures, cleanup
  auth/                         auth, session, reset, rate-limit, CSRF, RBAC tests
  dashboards/                   dashboard access, scoping, filtering, pagination
  db/                           client and tenant relationship tests
  e2e/                          Playwright lifecycle and Prompt 8 operation workflows
  services/                     lifecycle, registration, poster, attendance, feedback,
                                analytics, notification, and security tests
docs/
  authentication.md             auth/session/RBAC/rate-limit/CSRF design
  dashboards.md                 dashboard routes, authorization, actions, tests
  database.md                   ER diagram, tenancy, lifecycle, concurrency
  design-system.md              tokens, components, states, accessibility
  event-operations.md           lifecycle, poster rules, notifications, audit
  event-intelligence.md         OCR, recommendations, duplicates, conflicts
  attendance-feedback-analytics.md
                                QR attendance, feedback, ICS/CSV, analytics
  future-screens.md             screen specifications and implemented status
  poster-storage.md             poster storage, validation, delivery, caveats
  security-review.md            security review with Prompt 8 addendum
  PROMPT_9_*.md                 readiness audit, security, reliability,
                                performance, accessibility, architecture,
                                deployment, environment, backup/recovery,
                                operations, and final verification
```

## Architecture

### Database access layer

- `src/server/db/config.ts` validates URLs/pool settings, exposes strict
  test-database guards, and refuses remote/test targets for the seed.
- `src/server/db/factory.ts` creates short-lived Prisma clients for tests, the
  seed, and the health script without importing the Next.js `server-only` guard.
- `src/server/db/client.ts` provides the hot-reload-safe singleton, health check,
  and disconnect helper.
- `src/server/db/tenant.ts` creates validated per-call tenant context; there is
  no mutable global tenant.
- `src/server/db/audit.ts` redacts metadata and writes audit rows inside the
  caller's transaction.
- `src/server/db/transactions.ts` classifies Prisma errors and retries
  serialization/deadlock failures without retrying domain errors.
- `src/server/errors.ts` contains typed domain errors with safe status codes.

### Authentication and sessions

- `src/server/auth/auth.ts` configures Better Auth, the Prisma adapter,
  Argon2id hashing, database sessions, disabled public sign-up, and cookies.
- `src/server/auth/session.ts` verifies the session, reloads the actor from
  PostgreSQL, and provides server-only RBAC/tenant guards.
- `src/server/auth/actor.ts` loads role, college, status, and active club
  memberships from the database.
- `src/server/auth/password-reset.ts` stores only SHA-256 token hashes, enforces
  30-minute expiry/single use/prior-token invalidation, replaces the credential,
  and revokes sessions.
- `src/server/auth/rate-limit.ts` implements atomic PostgreSQL fixed-window rate
  limiting with HMAC lookup keys.
- `src/server/auth/csrf.ts` validates `Origin` and `Sec-Fetch-Site`.
- `src/server/auth/super-admin.ts` implements the CLI-only bootstrap core.
- `src/features/auth/actions.ts` contains the Server Actions for login,
  registration, password reset, and logout.

Better Auth's HTTP handler is not mounted as a public route. Auth mutations run
through Server Actions, and no browser payload supplies actor identity, role, or
college.

### Services

- `src/services/events.ts`: draft creation, draft/rejected edits, explicit
  lifecycle transitions, authorization, cancellation cascade, audit.
- `src/services/registrations.ts`: registration, deadline/window/capacity checks,
  duplicate prevention, cancellation, row locking, audit.
- `src/services/clubs.ts`: college-scoped club approval/rejection and active
  club profile updates.
- `src/services/users.ts`: constrained role changes with self-escalation guards,
  target-session revocation, and auth audit.
- `src/services/user-status.ts`: college/platform account status changes with
  session revocation and auth audit.
- `src/services/colleges.ts`: college settings and platform-only college
  lifecycle changes.
- `src/services/saved-events.ts`: idempotent student saved events with tenant
  checks and audit.
- `src/services/student-profile.ts`: validated student profile and interest
  updates.
- `src/services/notifications.ts`: user-scoped notification read state.
- `src/services/posters.ts`: content-validated poster upload/replacement/
  removal, status and manager authorization, access-controlled delivery,
  audit, and post-commit file cleanup.
- `src/services/poster-ocr.ts`: explicit OCR processing claims, field review,
  accepted-value application through the event update path, safe failures, and
  audit.
- `src/services/recommendations.ts`: deterministic, explainable, tenant-scoped
  student recommendations from real interest/category/timing/popularity signals.
- `src/services/duplicate-events.ts`: lexical same-day duplicate scoring,
  advisory persistence, and college-scoped confirm/dismiss review.
- `src/services/schedule-conflicts.ts`: strict interval-overlap detection,
  pre-registration lookup, and registration-time revalidation.
- `src/services/notification-recipients.ts`: active club-manager and confirmed
  registrant recipient lookup inside the business transaction.
- `src/services/attendance.ts`: post-start attended/no-show transitions,
  event-bound QR credential issuance, scanner/manual check-in, and reasoned
  corrections with audit.
- `src/services/attendance-credentials.ts`: signed, event-bound attendance
  token creation and verification helpers.
- `src/services/feedback.ts`: attended-completed-event eligibility, the 30-day
  submission/edit window, club read models, and college-admin moderation.
- `src/services/calendar.ts`: authenticated single-event, registered-event, and
  saved-event ICS generation with stable UIDs and escaped text.
- `src/services/authorization.ts`: trusted actor type, active-account checks,
  role/college assertions, and club membership checks.
- `src/services/validation.ts`: Zod input validation, date ordering, slugging.

Poster storage is server-only under `src/server/storage/`; image validation is
under `src/server/posters/`; OCR extraction and the local Tesseract engine are
under `src/server/ocr/`; notification inserts are in
`src/server/db/notifications.ts`; CSV serialization is under
`src/server/exports/`. See `docs/poster-storage.md`,
`docs/event-operations.md`, `docs/event-intelligence.md`, and
`docs/attendance-feedback-analytics.md`.

Services accept a trusted `AuthenticatedActor` first argument. They reload the
actor's role/college/membership state from PostgreSQL before acting. They are not
exposed as public business APIs in this phase.

### Dashboards and Server Actions

- `src/server/auth/page-guard.ts` keeps users inside the correct role workspace
  and redirects disabled or unauthenticated sessions safely.
- `src/server/dashboards/access.ts` contains dashboard role, managed-club,
  college-scope, and club-manager assertions.
- `src/server/dashboards/queries.ts` is server-only. Every query accepts the
  trusted actor, re-checks authorization, scopes by college/club, and returns real
  database rows, counts, filters, and pagination.
- `src/server/dashboards/engagement-analytics.ts` and `feedback.ts` contain the
  server-only Prompt 8 attendance, analytics, notification, and feedback read
  models. `src/lib/analytics-query.ts` parses and normalizes filter input.
- `src/features/dashboards/actions.ts` contains dashboard Server Actions. Each
  action checks the origin, loads the current actor, converts FormData into
  service input, calls the existing domain service, revalidates affected routes,
  and returns safe error states.
- `src/components/dashboard/` contains the responsive role shell, navigation,
  metric cards, accessible bar lists, event cards, and form primitives.
- `src/app/student/`, `src/app/club/`, `src/app/college/`, and
  `src/app/platform/` contain the four role-specific route trees.

See `docs/dashboards.md` for the complete route map, authorization matrix, and
Server Action sequence.

## Event lifecycle

```text
DRAFT -> PENDING_APPROVAL
PENDING_APPROVAL -> PUBLISHED | REJECTED | CANCELLED
REJECTED -> DRAFT
PUBLISHED -> CANCELLED | COMPLETED
CANCELLED, COMPLETED -> terminal
```

Club administrators may submit, edit, cancel, and complete only events belonging
to their own active club. College administrators may act within their own college.
Students cannot approve, publish, or transition events. Platform administrators
may review and transition existing events across colleges and approve clubs, but
event creation is club-manager-only because the composite creator foreign key
requires a same-college user. Invalid transitions and stale concurrent
transitions are rejected. Cancelling an event cancels confirmed registrations and
writes cancellation notifications in the same transaction. Approval and
rejection write club-manager notifications in the same transaction.

Poster management follows the lifecycle: allowed for `DRAFT`, `REJECTED`, and
`PUBLISHED`; locked for `PENDING_APPROVAL`, `CANCELLED`, and `COMPLETED`.
Published posters are visible to authenticated same-college users; unpublished
posters are limited to the owning club manager, same-college college
administrators, and platform administrators.

Submitting a draft starts advisory duplicate detection after the transition
commits. College administrators can confirm or dismiss suggestions, but review
never changes either event automatically. Draft/rejected events with a primary
poster can also run local OCR; accepted values go through the normal event update
path and OCR never submits or publishes an event.

See `docs/database.md` for the full authorization matrix and the justification
for the additional `PENDING_APPROVAL -> CANCELLED` and
`PUBLISHED -> COMPLETED` transitions. See `docs/event-operations.md` for the
operational matrix and `docs/poster-storage.md` for storage and delivery.

## Registration concurrency

Registration is protected at the database level, not by a frontend check:

1. The student profile supplies the college.
2. A transaction runs a parameterized
   `SELECT ... FROM events WHERE id = $1 AND collegeId = $2 ... FOR UPDATE`.
3. The event is checked for published/active status, start time, opening time,
   and deadline.
4. Active registrations (`CONFIRMED` + `ATTENDED`) are counted while the event
   row is locked.
5. Schedule conflicts are revalidated with strict interval overlap and recorded
   in audit metadata as advisory warnings.
6. The registration is inserted or reactivated.
7. The confirmation notification and audit record are written in the same
   transaction.

`@@unique([eventId, studentProfileId])` prevents duplicate rows. Prisma `P2002`
is translated to `ALREADY_REGISTERED`; `P2034` serialization/deadlock errors are
retried up to three times. Concurrent tests assert capacity 1 never becomes two
confirmed rows and duplicate concurrent attempts produce one row. Cancellation
updates the registration, writes the cancellation notification, and writes the
audit record in one transaction; a repeated cancellation is rejected by the
state guard rather than creating a duplicate notification.

## Tenant isolation and audit

Every tenant-owned table has `collegeId`, and composite foreign keys include it.
For example, an event references `(clubId, collegeId)` → `clubs(id, collegeId)`,
so a cross-college event/club pair is invalid at the database layer. Services
also derive the actor's college from the database and scope queries explicitly.

**Composite foreign keys protect relationships; they do not authorize API
requests.** Authorization is enforced separately by the auth/session layer and
service guards. PostgreSQL RLS is still not implemented.

Audit records cover event creation/updates, approval/rejection/cancellation,
poster upload/replacement/removal, club approval/rejection/profile updates,
role/status/profile changes, college settings/lifecycle changes, saved events,
notification reads, attendance, and registration changes. Auth events cover
registration, login, logout, reset, session revocation, and CLI bootstrap.
Poster audit metadata includes the event, club, previous poster ID when
replacing, detected MIME type, byte size, width, and height. Metadata is redacted
for passwords, secrets, tokens, authorization headers, cookies, API keys,
credentials, and session values. There is no application service to edit or
delete audit rows. Database-level immutability is not implemented.

## Security decisions and limitations

- PostgreSQL RLS is not implemented. Current tenancy is service scoping plus
  composite foreign keys. A direct database connection bypasses both.
- Production password recovery requires SMTP, which is not configured in this
  environment. Non-production may return a development reset link; production
  never returns or logs a reset token.
- IP rate limiting trusts `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.
  Deploy behind a trusted proxy that overwrites these headers.
- No email-verification flow exists; new students have `emailVerified=false`.
- The only upload surface is authenticated event-poster management. QR check-in
  is authenticated, event-bound, and available only to the owning club manager.
  There is no public business API or general media library.
- Poster storage is a local filesystem adapter for development and
  single-instance self-hosting. It is not shared, replicated, CDN-backed, or
  malware-scanned. Do not serve the storage directory directly.
- Notifications are in-app only. No email, push, SMS, outbox, or background
  delivery worker exists. Preferences suppress in-app registration, attendance,
  and feedback notifications; transactional moderation notifications are not
  user-suppressible.
- ICS downloads are one-way exports. There is no calendar subscription,
  two-way sync, or reminder scheduler.
- CSV exports are authorized, tenant-scoped, and protected against spreadsheet
  formula injection, but they are synchronous. Analytics breakdowns are capped
  at 5,000 rows and attendance exports at 10,000 registrations.
- The seed is development-only and local-only; it is not a production data path.
- Test cleanup is guarded by an exact database name and `current_database()`
  check. Tests must never point at the development database.
- Database credentials are never logged by the app. Local Docker credentials in
  `.env.example`/`docker-compose.yml` are intentionally non-production values.
- Audit metadata redaction reduces accidental secret storage but is not a
  substitute for never sending secrets into audit calls.
- Direct database superusers can modify audit rows; production roles should be
  least-privilege and database-level immutability should be considered later.

See `docs/authentication.md`, `docs/database.md`, and
`docs/security-review.md` for details.

## Troubleshooting

### Docker/PostgreSQL will not start

```powershell
docker compose ps
docker compose logs postgres
docker compose up -d
```

- Ensure Docker Desktop is running.
- Ensure port `5434` is free: `Get-NetTCPConnection -LocalPort 5434`.
- If a different local PostgreSQL owns `5434`, stop it or change the compose port
  and all three URLs in `.env.local`.

### `P1001` / connection refused

- Confirm the container is healthy: `docker compose ps`.
- Confirm `DATABASE_URL` uses `localhost:5434`, not `5432`.
- Confirm the database/user/password match `docker-compose.yml`.
- Run `npm run db:health`.

### Prisma client is stale or missing

```powershell
npm run db:generate
```

If the generated client is corrupted, remove `src/generated/prisma` and run
`npm run db:generate` again. Do not hand-edit generated files.

### Migration status is out of date

```powershell
npx prisma migrate status
npm run db:migrate:deploy
```

For local schema changes during development, use `npm run db:migrate` and review
the generated SQL before applying it. Do not use `migrate reset` on a database
whose data you need.

### Login fails or the session is not retained

- Confirm `BETTER_AUTH_SECRET` is at least 32 characters and stable across
  restarts.
- Confirm `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` use the same origin.
- In production, use HTTPS. Auth cookies are `Secure` in production, so an HTTP
  origin will not retain the session.
- Check that the account is `ACTIVE` and not deleted.
- Session cookies are `HttpOnly`, so they do not appear in `document.cookie`.

### Password reset email does not arrive

- `EMAIL_ENABLED=false` intentionally disables delivery. Non-production may show
  a development reset link instead.
- For production, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`,
  `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`, and `EMAIL_ENABLED=true`.
- Verify provider SPF/DKIM/DMARC and link-domain configuration.
- Do not log reset tokens while debugging.

### Super-admin bootstrap refuses to run

- Use an existing, active account; bootstrap never creates users.
- Add the explicit `--confirm-super-admin` flag.
- Promotion revokes the user's sessions; sign in again afterward.
- Do not use the command as a public endpoint or automate it at startup.

### Tests refuse to run

- Add `TEST_DATABASE_URL` to `.env.local`.
- The database name must be exactly `campuspulse_test`.
- The host must be local (`localhost`, `127.0.0.1`, or `::1`).
- Ensure the Docker user can create the test database. The default
  `campuspulse` user is a local superuser in the compose setup.
- Do not run tests with `NODE_ENV=production`.

### Port 3000 is already in use

```powershell
Get-NetTCPConnection -LocalPort 3000
Stop-Process -Id <PID>
```

Then rerun `npm run dev` or rebuild before `npm run start`.

### Prisma CLI does not see `.env.local`

`prisma.config.ts` explicitly loads `.env.local`. Confirm the file exists at the
repository root and that `DIRECT_URL` is set. The CLI uses `DIRECT_URL`; the app
runtime uses `DATABASE_URL`.

## Verification checklist

Run from the repository root:

```powershell
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run db:validate
npm run db:generate
npx prisma migrate status
npm run db:health
npm test
npm run build
npm run test:e2e
```

Then start `npm run dev` and verify the landing page plus `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/unauthorized`, `/account-disabled`, and
`/account`. Sign in as each role and verify the four dashboard overviews plus
their role-specific routes:

- `/student`, `/student/discover`, `/student/registrations`, `/student/saved`,
  `/student/calendar`, `/student/notifications`, `/student/feedback`,
  `/student/profile`
- `/club`, `/club/events`, `/club/registrations`, `/club/attendance`,
  `/club/feedback`, `/club/analytics`, `/club/settings`
- `/college`, `/college/events`, `/college/approvals`, `/college/clubs`,
  `/college/users`, `/college/feedback`, `/college/analytics`,
  `/college/audit-logs`, `/college/settings`
- `/platform`, `/platform/colleges`, `/platform/users`, `/platform/analytics`,
  `/platform/audit-logs`, `/platform/settings`

For the Prompt 6 poster workflow, sign in as a club administrator, create a
draft with a PNG/JPEG/WebP poster, confirm the preview and current poster, submit
for approval, approve it as a college administrator, view it as a same-college
student, register, confirm the registration notification, cancel, replace the
poster, verify the old URL returns `404`, verify cross-college and unauthenticated
access is denied, then remove the poster and confirm the empty state.

For Prompt 7, create a draft with a readable poster, run OCR, review and accept
only selected fields, and confirm the event remains a draft. Submit two similar
same-day events and confirm a college administrator sees an advisory duplicate
suggestion that can be confirmed or dismissed without changing either event.
Register a student for overlapping events and confirm the advisory warning, then
verify adjacent events do not warn. Check the student overview recommendations
and their explanations. Repeat the event, recommendation, duplicate, and warning
views at 360, 390, 768, 1024, 1280, and 1440 pixel widths.

For Prompt 8, complete a seeded event and open `/club/attendance`. Issue/scan a
QR credential or use the manual token fallback, verify the check-in timestamp,
record a reasoned correction, and download the attendance CSV. As the student,
submit feedback from `/student/feedback` and confirm it appears read-only in
`/club/feedback`; as a college administrator, hide and restore it from
`/college/feedback`. Download single-event, registered-event, and saved-event
ICS files, then download all four analytics CSVs and confirm the UTF-8 BOM,
CRLF rows, and tenant-scoped contents. Exercise date/event/club/category/status
filters on `/club/analytics`, `/college/analytics`, and `/platform/analytics`.
Open `/student/notifications`, use unread/type filters and pagination, toggle
registration/attendance/feedback preferences, and verify deep links. Repeat the
attendance and notification views at 390 px.

Check the mobile drawer, keyboard focus, fonts, browser console, session
persistence, logout, generic auth errors, filters, pagination, empty states, and
cross-role redirects. Verify dashboard and event-detail layouts at 360, 390, 768,
1024, 1280, and 1440 pixel widths. Stop any stale production server before
rebuilding.

For the final Prompt 10 gate, run:

```powershell
npx prisma validate
npm run db:generate
npm run typecheck
npm run lint
npm run format:check
git diff --check
npm run build
npm test
```

The Prompt 10 capture report at
`docs/screenshots/prompt-10/capture-report.json` records 50 audited route visits
and 27 screenshots at all six widths, with no browser console errors, no
non-success routes, and no horizontal overflow. The exact final gate results and
remaining production limitations are in
[`docs/FINAL_VERIFICATION_REPORT.md`](docs/FINAL_VERIFICATION_REPORT.md).

## Documentation

- [Authentication, sessions, RBAC, rate limits, CSRF, bootstrap](docs/authentication.md)
- [Dashboard routes, authorization, Server Actions, saved events](docs/dashboards.md)
- [Database architecture, ER diagram, tenancy, lifecycle, concurrency](docs/database.md)
- [Event lifecycle, poster rules, notifications, audit](docs/event-operations.md)
- [OCR, recommendations, duplicate review, schedule conflicts](docs/event-intelligence.md)
- [QR attendance, feedback, calendar/CSV exports, analytics, notifications](docs/attendance-feedback-analytics.md)
- [Poster storage, validation, delivery, production caveats](docs/poster-storage.md)
- [Design system](docs/design-system.md)
- [Future screen specifications](docs/future-screens.md)
- [Focused security review](docs/security-review.md)

### Submission readiness (Prompt 10)

- [Feature matrix](docs/FEATURE_MATRIX.md)
- [Submission guide](docs/SUBMISSION_GUIDE.md)
- [Project demo script](docs/PROJECT_DEMO_SCRIPT.md)
- [Final verification report](docs/FINAL_VERIFICATION_REPORT.md)
- [Prompt 10 screenshots](docs/screenshots/prompt-10/)
- [Prompt 10 capture report](docs/screenshots/prompt-10/capture-report.json)

### Production readiness (Prompt 9)

- [Final verification report](docs/PROMPT_9_VERIFICATION_REPORT.md)
- [Production readiness audit](docs/PROMPT_9_PRODUCTION_READINESS_AUDIT.md)
- [Security hardening](docs/PROMPT_9_SECURITY_HARDENING.md)
- [Reliability](docs/PROMPT_9_RELIABILITY_REPORT.md)
- [Performance](docs/PROMPT_9_PERFORMANCE_REPORT.md)
- [Accessibility](docs/PROMPT_9_ACCESSIBILITY_REPORT.md)
- [Production architecture](docs/PROMPT_9_PRODUCTION_ARCHITECTURE.md)
- [Deployment guide](docs/PROMPT_9_DEPLOYMENT_GUIDE.md)
- [Environment reference](docs/PROMPT_9_ENVIRONMENT_REFERENCE.md)
- [Backup and recovery](docs/PROMPT_9_BACKUP_AND_RECOVERY.md)
- [Operations runbook](docs/PROMPT_9_OPERATIONS_RUNBOOK.md)

## Scope boundary

Prompt 10 stops after the final submission polish and verification pass:
landing-page messaging and role preview, dashboard navigation and hierarchy,
responsive fixes, new evidence, and submission documentation. The final status
is **SUBMISSION READY WITH LIMITATIONS**. A live production deployment, live
S3/SMTP verification, load testing, a restore drill, public business APIs,
email/push/SMS notification delivery, two-way calendar sync, PostgreSQL RLS,
paid services, and external account changes remain future work. No production
deployment has been performed. Do not expose the services as public business
APIs until route-level authorization and production hardening are reviewed for
that phase.
