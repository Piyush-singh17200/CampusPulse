# CampusPulse

CampusPulse is a multi-college campus event discovery and moderation platform.
The repository contains the verified landing page, a responsive authentication
surface, a multi-tenant PostgreSQL schema, database-backed sessions, server-side
RBAC/tenant authorization, integration tests, and a safe fictional development
seed.

Prompt 4 is implemented through the account/authentication layer. Dashboards,
public business APIs, uploads, OCR, recommendations, notifications, production
email delivery, deployment, and PostgreSQL RLS remain future work.

## Current status

Implemented and verified in this phase:

- Responsive, accessible CampusPulse landing page with all 11 required sections.
- Next.js 16 App Router, strict TypeScript, ESLint, Prettier, and production build.
- PostgreSQL 17 Docker service on host port `5434`.
- Prisma schema with 22 models, enums, composite tenant foreign keys, indexes,
  timestamps, and deliberate deletion behavior.
- Three applied migrations: the initial schema, the event audit enum extension,
  and the additive auth/session/RBAC migration.
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
- CLI-only super-admin bootstrap with no public endpoint and no default password.
- Isolated Vitest integration suite against `campuspulse_test`, including
  concurrency, tenant, lifecycle, auth, session, reset, rate-limit, CSRF, RBAC,
  audit, and security tests.
- Idempotent, fictional, development-only seed.
- Design-system, database, authentication, security, and future-screen docs.

Intentionally deferred:

- Student/club/college/super-admin dashboards and public business APIs.
- OCR, poster uploads, duplicate-detection algorithms, and recommendations.
- Email verification, notification delivery, and production SMTP configuration.
- Production deployment, secret-manager integration, edge/HSTS hardening, and a
  penetration test.
- PostgreSQL RLS. Tenant isolation is currently application-layer scoping plus
  composite foreign keys. See `docs/database.md` and
  `docs/authentication.md`.

## Requirements

- Windows 10/11 with PowerShell (the project also runs on macOS/Linux).
- Node.js `>=20.19.0` (the repository has `.nvmrc`).
- npm (ships with Node).
- Docker Desktop with Docker Compose.
- Git (optional for local development; the repository currently has no commits).

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

| Variable                         | Required | Purpose                                                                   |
| -------------------------------- | -------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`                   | yes      | Runtime PostgreSQL connection; use a pooled URL in a hosted environment   |
| `DIRECT_URL`                     | yes      | Prisma CLI/migration connection; use a direct URL in a hosted environment |
| `TEST_DATABASE_URL`              | tests    | Separate URL whose database name is exactly `campuspulse_test`            |
| `NEXT_PUBLIC_APP_URL`            | yes      | Public origin used for metadata; never put secrets in `NEXT_PUBLIC_*`     |
| `BETTER_AUTH_SECRET`             | yes      | 32+ byte random secret used by Better Auth and default HMAC lookup keys   |
| `BETTER_AUTH_URL`                | yes      | Auth origin; use HTTPS in production                                      |
| `RATE_LIMIT_SECRET`              | no       | Separate 32+ byte key for HMAC rate-limit lookup keys                     |
| `EMAIL_ENABLED`                  | no       | `true` enables SMTP password-reset delivery                               |
| `SMTP_HOST`                      | email    | Required when `EMAIL_ENABLED=true`                                        |
| `SMTP_PORT`                      | no       | SMTP port, default `587`                                                  |
| `SMTP_SECURE`                    | no       | `true` for implicit TLS; usually `false` with STARTTLS on port 587        |
| `SMTP_USER` / `SMTP_PASSWORD`    | email    | Optional paired SMTP credentials; both or neither                         |
| `EMAIL_FROM`                     | email    | Sender address, required when email is enabled                            |
| `DATABASE_POOL_MAX`              | no       | Pool size, default `10`                                                   |
| `DATABASE_CONNECTION_TIMEOUT_MS` | no       | Connection timeout, default `5000`                                        |
| `DATABASE_IDLE_TIMEOUT_MS`       | no       | Idle timeout, default `30000`                                             |
| `DATABASE_SSL`                   | no       | `true` for a TLS-required hosted database                                 |
| `DATABASE_LOG_QUERIES`           | no       | Query logging; never enable in production                                 |

The app validates required values at startup. Errors name the invalid field but
never print credential values. The database layer additionally validates the
pool settings and refuses an unsafe test database.

Production notes:

- Set `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` to the same HTTPS origin.
- Generate distinct secrets from a secret manager; never reuse local values.
- Production auth cookies always include `Secure`; serve the app over HTTPS.
- Production password recovery requires SMTP. If `EMAIL_ENABLED=false`,
  production never returns or logs a reset token, so recovery is unavailable.
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
- Events in draft, pending, published, rejected, cancelled, and completed states.
- Fictional registrations and registrations in attended/no-show/cancelled states.

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
deadlines/capacity/cancellation, event lifecycle and audit, club/role
administration, audit redaction/rollback, security boundaries, concurrent
capacity/duplicate races, student registration, Argon2id hashes, Better Auth
sessions, logout/expiry/deleted sessions, disabled accounts, reset-token hashing,
expiry/single use/session revocation, PostgreSQL rate limits, CSRF/origin checks,
RBAC helpers, role-change session revocation, and CLI super-admin bootstrap.
Tests run sequentially (`fileParallelism: false`, `maxWorkers: 1`) so database
resets are deterministic.

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
  schema.prisma                 22-model multi-tenant + auth schema
  migrations/                   applied SQL migrations
  seed.ts                       guarded fictional development seed
scripts/
  bootstrap-super-admin.ts      CLI-only super-admin promotion
  check-db.ts                   database connection health check
src/
  app/                          App Router pages, auth pages, layouts, error boundaries
  components/                   brand, layout, auth, and UI primitives
  features/auth/                auth Server Actions and screens
  features/landing/             verified 11-section landing page
  config/                       environment, site, and security config
  server/auth/                  Better Auth, sessions, RBAC, reset, rate limits, audit
  server/db/                    client, config, tenant, audit, transactions
  server/email/                 optional SMTP delivery
  server/errors.ts              domain error types
  services/                     event, registration, club, user, authorization
  generated/prisma/             generated client (not hand-edited)
tests/
  global-setup.ts               test DB creation + migrate deploy
  setup.ts                      test URL/env guard
  helpers/                      factories, auth helpers, guarded cleanup
  auth/                         auth, session, reset, rate-limit, CSRF, RBAC tests
  db/                           client and tenant relationship tests
  services/                     lifecycle, registration, security tests
docs/
  authentication.md             auth/session/RBAC/rate-limit/CSRF design
  database.md                   ER diagram, tenancy, lifecycle, concurrency
  design-system.md              tokens, components, states, accessibility
  future-screens.md             future student/admin screen specifications
  security-review.md            Prompt 4 focused security review
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
- `src/services/clubs.ts`: college-scoped club approval/rejection.
- `src/services/users.ts`: constrained role changes with self-escalation guards,
  target-session revocation, and auth audit.
- `src/services/authorization.ts`: trusted actor type, active-account checks,
  role/college assertions, and club membership checks.
- `src/services/validation.ts`: Zod input validation, date ordering, slugging.

Services accept a trusted `AuthenticatedActor` first argument. They reload the
actor's role/college/membership state from PostgreSQL before acting. They are not
exposed as public business APIs in this phase.

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
transitions are rejected. Cancelling an event cancels confirmed registrations in
the same transaction.

See `docs/database.md` for the full authorization matrix and the justification
for the additional `PENDING_APPROVAL -> CANCELLED` and
`PUBLISHED -> COMPLETED` transitions.

## Registration concurrency

Registration is protected at the database level, not by a frontend check:

1. The student profile supplies the college.
2. A transaction runs a parameterized
   `SELECT ... FROM events WHERE id = $1 AND collegeId = $2 ... FOR UPDATE`.
3. The event is checked for published/active status, start time, opening time,
   and deadline.
4. Active registrations (`CONFIRMED` + `ATTENDED`) are counted while the event
   row is locked.
5. The registration is inserted or reactivated.
6. The audit record is written in the same transaction.

`@@unique([eventId, studentProfileId])` prevents duplicate rows. Prisma `P2002`
is translated to `ALREADY_REGISTERED`; `P2034` serialization/deadlock errors are
retried up to three times. Concurrent tests assert capacity 1 never becomes two
confirmed rows and duplicate concurrent attempts produce one row.

## Tenant isolation and audit

Every tenant-owned table has `collegeId`, and composite foreign keys include it.
For example, an event references `(clubId, collegeId)` → `clubs(id, collegeId)`,
so a cross-college event/club pair is invalid at the database layer. Services
also derive the actor's college from the database and scope queries explicitly.

**Composite foreign keys protect relationships; they do not authorize API
requests.** Authorization is enforced separately by the auth/session layer and
service guards. PostgreSQL RLS is still not implemented.

Audit records cover event creation/updates, approval/rejection/cancellation,
club approval/rejection, role changes, and registration changes. Auth events
cover registration, login, logout, reset, session revocation, and CLI bootstrap.
Metadata is redacted for passwords, secrets, tokens, authorization headers,
cookies, API keys, credentials, and session values. There is no application
service to edit or delete audit rows. Database-level immutability is not
implemented.

## Security decisions and limitations

- PostgreSQL RLS is not implemented. Current tenancy is service scoping plus
  composite foreign keys. A direct database connection bypasses both.
- Production password recovery requires SMTP, which is not configured in this
  environment. Non-production may return a development reset link; production
  never returns or logs a reset token.
- IP rate limiting trusts `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.
  Deploy behind a trusted proxy that overwrites these headers.
- No email-verification flow exists; new students have `emailVerified=false`.
- No public business API routes, dashboards, file uploads, or OCR exist.
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
```

Then start `npm run dev` and verify the landing page plus `/login`, `/register`,
`/forgot-password`, `/reset-password`, `/unauthorized`, `/account-disabled`, and
`/account` at desktop and mobile widths. Check the mobile menu, fonts, browser
console, session persistence, logout, and generic auth errors. Stop any stale
production server before rebuilding.

## Documentation

- [Authentication, sessions, RBAC, rate limits, CSRF, bootstrap](docs/authentication.md)
- [Database architecture, ER diagram, tenancy, lifecycle, concurrency](docs/database.md)
- [Design system](docs/design-system.md)
- [Future screen specifications](docs/future-screens.md)
- [Focused security review](docs/security-review.md)

## Scope boundary

Prompt 4 stops before student/club/college/super-admin dashboards, OCR,
recommendation algorithms, notifications, production deployment, commits,
pushes, paid services, or external account changes. PostgreSQL RLS, production
SMTP, and deployment hardening remain future work. Do not expose the services as
public business APIs until route-level authorization and production hardening are
reviewed for that phase.
