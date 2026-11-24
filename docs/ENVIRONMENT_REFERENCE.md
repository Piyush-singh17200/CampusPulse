# Production Hardening — Environment Reference

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Contract for local and production environments

This document lists every environment variable the application reads, its
validation rules, and its production expectations. Values shown here are
placeholders, not real secrets.

## 1. Rules

- Never commit `.env.local`, `.env.production`, or any file containing real
  credentials.
- Use the hosting platform's secret manager or environment settings for
  production values.
- `NEXT_PUBLIC_*` values are embedded in the browser bundle. Never put a secret
  in one.
- The application validates the server environment at startup and fails with a
  field-level message (never the value) if a required variable is invalid.
- Use separate secrets for development, staging, and production.
- Rotate `BETTER_AUTH_SECRET`, `RATE_LIMIT_SECRET`, database credentials, S3
  keys, and SMTP credentials on a defined schedule and after any suspected
  exposure.

## 2. Core application

| Variable              | Required        | Validation                                       | Purpose                                                                 |
| --------------------- | --------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `NODE_ENV`            | Set by platform | `development`, `test`, or `production`           | Enables production cookies/HSTS and disables development-only behavior  |
| `DATABASE_URL`        | Yes             | Must start with `postgresql://` or `postgres://` | Application database connection; use the pooled URL in production       |
| `DIRECT_URL`          | Yes             | PostgreSQL URL                                   | Prisma CLI/migrations; use the direct/non-pooled URL in production      |
| `NEXT_PUBLIC_APP_URL` | Yes             | Absolute URL                                     | Public origin used in metadata and absolute links                       |
| `BETTER_AUTH_SECRET`  | Yes             | 32–512 characters                                | Session/token signing secret                                            |
| `BETTER_AUTH_URL`     | Yes             | Absolute URL                                     | Better Auth origin; defaults to `NEXT_PUBLIC_APP_URL` if omitted        |
| `RATE_LIMIT_SECRET`   | No              | 32–512 characters if set                         | HMAC key for rate-limit lookup keys; falls back to `BETTER_AUTH_SECRET` |

Proxy trust (optional):

| Variable              | Default | Purpose                                                          |
| --------------------- | ------- | ---------------------------------------------------------------- |
| `TRUST_PROXY_HEADERS` | `false` | Trust forwarded client-IP headers only behind a known proxy      |
| `TRUSTED_PROXY_HOPS`  | `1`     | Address position counted from the right of the `x-forwarded-for` |

Production notes:

- `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` must be the final HTTPS origin,
  for example `https://campuspulse.example.edu`.
- Do not use `http://` in production; secure cookies and HSTS depend on HTTPS.
  Localhost URLs remain accepted only for local production builds.
- Keep `TRUST_PROXY_HEADERS=false` when the Node process is directly reachable.
  Enable it only behind a proxy that overwrites forwarded headers, and set
  `TRUSTED_PROXY_HOPS` to the number of trusted proxies (usually `1`).
- Generate secrets with a cryptographically secure random source:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Database tuning

| Variable                         | Default       | Validation            | Purpose                                         |
| -------------------------------- | ------------- | --------------------- | ----------------------------------------------- |
| `DATABASE_POOL_MAX`              | `10`          | Integer 1–50          | Maximum pooled connections per app instance     |
| `DATABASE_CONNECTION_TIMEOUT_MS` | `5000`        | Integer 250–60,000    | Maximum wait for a connection                   |
| `DATABASE_IDLE_TIMEOUT_MS`       | `30000`       | Integer 1,000–600,000 | Idle connection timeout                         |
| `DATABASE_SSL`                   | `false`       | `true` or `false`     | Require TLS for the database connection         |
| `DATABASE_LOG_QUERIES`           | `false`       | `true` or `false`     | Log SQL; keep `false` in production             |
| `DATABASE_APP_NAME`              | `campuspulse` | 1–64 characters       | PostgreSQL `application_name` for observability |

Production notes:

- Set `DATABASE_SSL=true` when the provider requires TLS.
- Keep `DATABASE_LOG_QUERIES=false`; query parameters can contain personal data.
- Size `DATABASE_POOL_MAX` against the database's connection limit:
  `instances × pool + migrations + monitoring < limit`.

## 4. Authentication and email

| Variable        | Required         | Validation                                                           | Purpose                                    |
| --------------- | ---------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| `EMAIL_ENABLED` | No               | `true` or `false`; default `false`                                   | Enables SMTP delivery                      |
| `SMTP_HOST`     | If email enabled | 1–255 characters                                                     | SMTP server                                |
| `SMTP_PORT`     | No               | Integer 1–65,535; default `587`                                      | SMTP port                                  |
| `SMTP_SECURE`   | No               | `true` or `false`; default `false`                                   | Implicit TLS (usually `true` for port 465) |
| `SMTP_USER`     | No               | Up to 320 characters                                                 | SMTP username                              |
| `SMTP_PASSWORD` | No               | Up to 1,000 characters                                               | SMTP password or app password              |
| `EMAIL_FROM`    | If email enabled | 1–320 characters; default `CampusPulse <no-reply@campuspulse.local>` | From address                               |

Validation rules:

- `EMAIL_ENABLED=true` requires `SMTP_HOST`.
- `SMTP_USER` and `SMTP_PASSWORD` must be set together.
- `EMAIL_ENABLED=false` is valid for local development. In development, the
  reset URL may be returned to the browser; in production it never is.
- Password recovery is unavailable in production without working SMTP.

Production checklist:

- Verify SPF, DKIM, and DMARC for the sending domain.
- Send a real password-reset email and complete the flow.
- Confirm the reset token is never written to logs or returned in the response.

## 5. Poster storage

| Variable                | Required | Validation                                      | Purpose                                            |
| ----------------------- | -------- | ----------------------------------------------- | -------------------------------------------------- |
| `POSTER_STORAGE_DRIVER` | No       | `local` or `s3`; default `local`                | Storage adapter                                    |
| `POSTER_STORAGE_DIR`    | No       | 1–1,024 characters                              | Local root; default `.data/posters`                |
| `S3_ENDPOINT`           | If S3    | Absolute URL                                    | S3-compatible endpoint                             |
| `S3_REGION`             | If S3    | 1–64 characters                                 | Signing region                                     |
| `S3_BUCKET`             | If S3    | 3–255 characters                                | Private bucket name                                |
| `S3_ACCESS_KEY_ID`      | If S3    | 1–255 characters                                | Access key                                         |
| `S3_SECRET_ACCESS_KEY`  | If S3    | 1–512 characters                                | Secret key                                         |
| `S3_SESSION_TOKEN`      | No       | 1–8,192 characters                              | Temporary credential session token                 |
| `S3_ALLOW_INSECURE`     | No       | `true` or `false`; default `false`              | Allow non-local HTTP outside production only       |
| `S3_FORCE_PATH_STYLE`   | No       | `true` or `false`; default `true`               | Path-style URLs (MinIO and most non-AWS providers) |
| `S3_PREFIX`             | No       | Up to 200 characters; safe path characters only | Key prefix inside the bucket                       |

Production notes:

- Use `POSTER_STORAGE_DRIVER=s3` for any multi-instance or ephemeral-filesystem
  deployment.
- Keep the bucket private. Do not add a public bucket policy or public object
  ACL.
- Use a dedicated access key with only `PutObject`, `GetObject`, and
  `DeleteObject` on the poster prefix.
- `S3_FORCE_PATH_STYLE=true` for MinIO, Cloudflare R2 (path-style is supported),
  and most non-AWS endpoints; test the chosen provider.
- Production requires an `https://` S3 endpoint. `S3_ALLOW_INSECURE` only
  permits a non-local HTTP endpoint outside production and is rejected in
  production.
- For temporary credentials, set `S3_SESSION_TOKEN`; it is included in SigV4
  signing. Do not use root credentials.
- The adapter is not exercised against a live bucket in Production Hardening. Run the
  deployment smoke test before launch.

## 6. Build and test-only variables

| Variable              | Scope | Purpose                                                                               |
| --------------------- | ----- | ------------------------------------------------------------------------------------- |
| `NEXT_BUILD_CPUS`     | Build | Number of Next.js page-data workers; defaults to `2`                                  |
| `TEST_DATABASE_URL`   | Tests | Isolated `campuspulse_test` database; tests refuse any other name or a non-local host |
| `PLAYWRIGHT_BASE_URL` | E2E   | Target origin; defaults to `http://localhost:3000`                                    |

`TEST_DATABASE_URL` is not read by the production application. It is used by
the test setup and must point at a local PostgreSQL instance with a database
named exactly `campuspulse_test`.

## 7. Recommended production template

```dotenv
NODE_ENV=production

DATABASE_URL="postgresql://USER:PASSWORD@POOL_HOST:5432/campuspulse?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST:5432/campuspulse?sslmode=require"
DATABASE_POOL_MAX=10
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_SSL=true
DATABASE_LOG_QUERIES=false
DATABASE_APP_NAME=campuspulse

NEXT_PUBLIC_APP_URL="https://campuspulse.example.edu"
BETTER_AUTH_URL="https://campuspulse.example.edu"
BETTER_AUTH_SECRET="<32+ byte random secret>"
RATE_LIMIT_SECRET="<separate 32+ byte random secret>"
TRUST_PROXY_HEADERS=true
TRUSTED_PROXY_HOPS=1

EMAIL_ENABLED=true
SMTP_HOST="smtp.example.edu"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="<smtp user>"
SMTP_PASSWORD="<smtp app password>"
EMAIL_FROM="CampusPulse <no-reply@example.edu>"

POSTER_STORAGE_DRIVER=s3
S3_ENDPOINT="https://s3.example-provider.com"
S3_REGION="auto"
S3_BUCKET="campuspulse-posters"
S3_ACCESS_KEY_ID="<access key>"
S3_SECRET_ACCESS_KEY="<secret key>"
# S3_SESSION_TOKEN="<temporary-credential token>"  # only for temporary credentials
S3_ALLOW_INSECURE=false
S3_FORCE_PATH_STYLE=true
S3_PREFIX="posters"
```

Do not copy this template into a committed file with real values.

## 8. Local development template

The repository's `.env.example` is the source of truth for local development.
It uses:

- PostgreSQL on `localhost:5434` (the project's Docker port).
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
- `EMAIL_ENABLED=false`.
- `POSTER_STORAGE_DRIVER=local`.
- A placeholder `BETTER_AUTH_SECRET` that must be replaced.

The seed command is development-only and refuses to run against a remote host,
the test database, or `NODE_ENV=production`.

## 9. Secret rotation

| Secret               | Rotation impact                                                     | Procedure                                                      |
| -------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `BETTER_AUTH_SECRET` | Existing sessions may be invalidated depending on Better Auth usage | Rotate during a maintenance window; force re-login if required |
| `RATE_LIMIT_SECRET`  | Existing limiter keys no longer match; windows effectively reset    | Rotate with a deploy; old rows expire naturally                |
| Database password    | App loses access until updated                                      | Update provider, deploy new env, verify health                 |
| S3 keys              | Poster upload/delivery fails until updated                          | Create new key, deploy, revoke old key                         |
| SMTP password        | Password-reset delivery fails                                       | Update provider/app password, send a test reset                |

After any rotation, run the health check and the relevant smoke test.

## 10. Validation failure behavior

Startup validation errors name the field and the rule, for example:

```text
Invalid environment configuration. BETTER_AUTH_SECRET: BETTER_AUTH_SECRET must contain at least 32 characters.
```

Values are never included. If the application fails to start, check the field
names in this document first; do not print the environment to a shared log.

## 11. References

- `.env.example`
- `src/config/env.ts`
- `src/server/db/config.ts`
- `next.config.ts`
- `docs/DEPLOYMENT_GUIDE.md`
- `docs/OPERATIONS_RUNBOOK.md`
