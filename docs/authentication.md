# Authentication, sessions, and authorization

Scope: Prompt 4 authentication and server-side authorization for CampusPulse.
This document describes the implemented controls and the remaining limitations.
It is not a production-readiness claim.

## Library decision

CampusPulse uses **Better Auth 1.7.18** with its Prisma adapter and a custom
password-reset implementation. Better Auth was selected because its peer
dependencies explicitly support the repository's Next.js 16 and Prisma 7
versions, it provides database-backed email/password sessions, and it can run
locally without an external identity provider or paid service.

Auth.js was evaluated and not selected. Its current stable line is v4, while the
App Router-oriented v5 was still beta at implementation time, and a
credentials + database-session integration would have required more custom
work than the selected option.

Installed auth-related dependencies:

- `better-auth@1.7.18`
- `@better-auth/prisma-adapter@1.7.18`
- `@node-rs/argon2@2.2.2`
- `nodemailer@10.4.0` (optional SMTP delivery)

## Database model

The additive migration `20261109081554_auth_sessions_rbac` adds:

- `User.emailVerified` and `User.image` for Better Auth compatibility.
- Better Auth `Session`, `Account`, and `Verification` tables.
- `PasswordResetToken` with a unique SHA-256 `tokenHash`, expiry, and `usedAt`.
- `RateLimitEntry` with a unique HMAC lookup key, fixed-window count, and expiry.
- `AuthAuditEvent` for anonymous/unknown-email auth events that cannot use the
  required-actor `AuditLog` table.
- `AuthAuditEventType` values for registration, login, logout, reset, bootstrap,
  and session revocation.

Credential password hashes live in `Account.password`; `User` has no password
column. Better Auth's public sign-up endpoint is disabled. Registration is a
validated Server Action that always assigns `STUDENT` and creates the user,
student profile, and credential account in one transaction.

## Password hashing

- Argon2id via `@node-rs/argon2`.
- Parameters: 19,456 KiB memory, 2 iterations, parallelism 1, 32-byte output.
- Only PHC hashes are stored. Plaintext passwords are never written to the
  database, audit metadata, logs, or returned to the browser.
- Unknown and inactive login attempts perform comparable Argon2id work to reduce
  account-enumeration timing differences.

## Sessions

- Database-backed Better Auth sessions with a 7-day expiry and 24-hour rolling
  refresh.
- Cookie cache is disabled so authorization re-reads the database session and
  actor state.
- Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when the auth
  URL is HTTPS. Production always sets `Secure`; production deployments must use
  HTTPS end to end.
- The session identity is only a user ID. Role, college, status, and club
  memberships are reloaded from PostgreSQL on every `getCurrentUser()` call.
- Disabled/deleted users fail closed in `loadActorContext()`.
- Password reset, role changes, and CLI super-admin promotion revoke all
  sessions for the affected user.

Better Auth's HTTP handler is not mounted as a public route. Auth mutations run
through Server Actions, which use `nextCookies()` to apply cookie changes and
explicit same-origin checks.

## Authorization

The four existing roles are the only role system:

- `STUDENT`
- `CLUB_ADMIN`
- `COLLEGE_ADMIN`
- `SUPER_ADMIN`

Services now accept a trusted `AuthenticatedActor` first argument. They do not
accept `actorUserId`, role, college, or membership values from request payloads.
The actor is built from the verified session plus a fresh database read.

`src/services/authorization.ts` and `src/server/auth/session.ts` provide:

- Active-account and role assertions.
- College-scope assertions.
- Active club-membership checks.
- `requireAuthenticatedUser`, `requireRole`, `requireCollegeAccess`,
  `requireCollegeAdmin`, `requirePlatformAdmin`, and `requireClubAccess`.

Deny-by-default behavior applies. Unauthorized actions return safe authorization
errors; cross-tenant object access returns a not-found-style response where
appropriate to avoid confirming another tenant's object existence. Tenant
isolation is still **application-layer scoping plus composite foreign keys**, not
PostgreSQL RLS. Do not describe it as database-enforced authorization.

## CSRF and origin protection

- Auth mutations are Next.js Server Actions, which have built-in origin checks.
- `assertSameOrigin()` additionally validates the `Origin` header against
  `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL`.
- `Sec-Fetch-Site` is rejected unless it is absent, `same-origin`, or `none`.
- Better Auth CSRF checks remain enabled; its in-memory rate limiter is disabled
  in favor of the PostgreSQL limiter.

## Rate limiting

Rate limiting is PostgreSQL-backed, not in-memory:

- `RateLimitEntry` uses one atomic `INSERT ... ON CONFLICT ... DO UPDATE`.
- Concurrent attempts are serialized by the unique key and row lock.
- Lookup keys are HMAC-SHA256 digests, so raw emails and IP addresses are not
  stored in the rate-limit table.
- Current policies:
  - Login per email: 5 / 15 minutes.
  - Login per IP: 20 / 15 minutes.
  - Registration per IP: 5 / hour.
  - Registration per email: 3 / hour.
  - Password reset request per email: 3 / hour.
  - Password reset request per IP: 10 / hour.
  - Password reset completion per IP: 10 / hour.
- Expired rows can be pruned with `pruneExpiredRateLimits()`.

IP extraction trusts `x-forwarded-for`, `x-real-ip`, or `cf-connecting-ip`.
Deploy behind a trusted proxy/platform that overwrites these headers; otherwise a
client could spoof its apparent IP.

## Password recovery

The custom flow is used instead of Better Auth's built-in reset flow because the
built-in flow stores the raw reset token in `Verification.identifier`.

Implemented behavior:

- 256-bit random token, URL-safe encoding.
- Only SHA-256(token) is stored.
- 30-minute expiry.
- Single use enforced by an atomic claim.
- A new request marks all previous unused tokens as used.
- Successful reset replaces the Argon2id credential hash.
- Successful reset revokes every session and invalidates remaining reset tokens.
- Unknown/inactive emails receive the same response and do not reveal account
  existence.
- When SMTP is disabled outside production, the action returns a development
  reset link. Production never returns or logs a reset token.
- When SMTP is enabled, the reset link is delivered by Nodemailer. Delivery
  failures are audited and the caller still receives the generic response.

**SMTP is not configured in this environment.** Production email delivery and
production password recovery are therefore not tested here. See
`NOT CONFIGURED` in the final verification report.

## Audit events

Auth audit events are separate from the business `AuditLog` because
`AuditLog.actorUserId` is required and some auth events are anonymous. Events
include registration, login success/failure, logout, reset requested/completed/
failed, super-admin provisioning, and session revocation. Email/IP values in auth
audit rows are HMAC digests. Metadata is passed through the existing redaction
helper.

## CLI super-admin bootstrap

There is no public bootstrap endpoint, no default password, and no automatic
startup provisioning.

```powershell
npm run auth:bootstrap-super-admin -- existing-user@example.com --confirm-super-admin
```

The command:

1. Requires the explicit confirmation flag and an existing account email.
2. Refuses missing, deleted, or inactive accounts.
3. Promotes an active account to `SUPER_ADMIN` in a transaction.
4. Revokes all of that user's sessions.
5. Writes a `SUPER_ADMIN_PROVISIONED` auth audit event with source `cli`.
6. Never creates a credential or password.

The command is idempotent for an existing super administrator.

## Auth screens

Implemented screens under the `(auth)` route group:

- `/login`
- `/register`
- `/forgot-password`
- `/reset-password?token=...`
- `/unauthorized`
- `/account-disabled`
- `/account` (minimal authenticated account home)

The landing page and existing design system were preserved. Auth entry links were
added to the landing header.

## Tests

The auth suite covers:

- Registration, forced `STUDENT` role, profile/account transaction, duplicate
  email, inactive college, weak password, Argon2id hashes, and audit redaction.
- Better Auth sign-in, cookie verification, logout, expiry, deleted sessions, and
  disabled-account actor rejection.
- Reset token hash-only storage, expiry, single use, prior-token invalidation,
  password replacement, session revocation, and generic unknown/inactive
  behavior.
- PostgreSQL rate-limit increments, concurrency, limits, key hashing, namespaces,
  window reset, and cleanup.
- Origin/CSRF checks, actor reload, RBAC helpers, tenant isolation, role-change
  session revocation, and CLI bootstrap.

Tests run against the isolated `campuspulse_test` database and are not a
substitute for production SMTP, deployment, or RLS testing.

## Remaining limitations

- No PostgreSQL RLS. Application-layer scoping and composite foreign keys remain
  the tenant controls.
- No email verification flow; `emailVerified` remains false for new students.
- SMTP is not configured; production recovery is not operational here.
- IP rate limiting depends on trusted proxy headers.
- No public auth API route is mounted; if one is added later, it must reuse these
  controls and be reviewed for CSRF/rate-limit exposure.
- No production deployment, secret manager, HSTS/edge configuration, or
  penetration test has been performed.
