# Prompt 9 — Deployment Guide

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Ready to execute after approval; **no production deployment has been performed**

This guide is the operational procedure for a first production deployment. It
assumes the security and reliability gates in
`docs/PROMPT_9_VERIFICATION_REPORT.md` have passed and the owner has explicitly
approved the target environment, domain, and any paid services.

## 0. Approval and preconditions

Do not start until all of these are true:

- [ ] The owner has approved the deployment, domain, hosting provider, database
      provider, object storage, SMTP provider, and any recurring cost.
- [ ] The changes to be deployed are committed and reviewed. The current
      working tree is intentionally dirty during Prompt 9; do not deploy
      uncommitted work without the owner's review.
- [ ] Production credentials exist in a secret manager, not in a file that will
      be committed.
- [ ] A rollback owner and maintenance window are agreed.
- [ ] A database backup exists before the first migration.
- [ ] The target has Node.js 20.19+ (Node 24 is verified locally), npm, and
      network access to PostgreSQL, object storage, and SMTP.
- [ ] The deployment target can run a long-lived Node process. This project
      does not currently emit a standalone server bundle; it runs `next start`
      from the app directory.

## 1. Provision infrastructure

### 1.1 Domain and TLS

- Point the production domain at the load balancer or reverse proxy.
- Issue a certificate and enable HTTP → HTTPS redirect.
- Confirm the proxy forwards `Host`, `X-Forwarded-Proto`, and `X-Forwarded-For`
  correctly.
- Do not strip the application's security headers.

### 1.2 PostgreSQL

- Create a dedicated database and least-privilege application user.
- Record both the pooled and direct connection strings.
- Enable TLS if the provider requires it.
- Enable automated backups and, if available, point-in-time recovery.
- Confirm the provider's PostgreSQL version is supported by Prisma 7 and the
  project's migrations.
- Do not expose the database port publicly.

### 1.3 Object storage

This guide uses a private S3-compatible bucket because it is the safe default for
multi-instance or ephemeral-filesystem deployments. A single-instance pilot with
a durable volume may use `POSTER_STORAGE_DRIVER=local` instead; that mode is not
shared across instances and must be included in backups. See
`docs/poster-storage.md`.

- Create a private bucket for posters.
- Block public access and public ACLs.
- Create an access key limited to `PutObject`, `GetObject`, and `DeleteObject`
  on the poster prefix.
- Enable server-side encryption at rest.
- Optionally enable versioning and a lifecycle rule for noncurrent versions.
- Record the endpoint, region, bucket, prefix, and keys.

### 1.4 SMTP

- Create a sending identity and app password.
- Configure SPF, DKIM, and DMARC for the domain.
- Record `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASSWORD`, and `EMAIL_FROM`.

### 1.5 Monitoring

- Add an HTTPS check for `/api/health` every 30–60 s.
- Alert on `503`, timeout, or three consecutive failures.
- Configure log collection with secret redaction.
- Add database storage/connection alerts and object-storage error alerts.

## 2. Configure the environment

Use `docs/PROMPT_9_ENVIRONMENT_REFERENCE.md` as the contract. Minimum
production values:

```dotenv
NODE_ENV=production
DATABASE_URL="<pooled PostgreSQL URL>"
DIRECT_URL="<direct PostgreSQL URL>"
NEXT_PUBLIC_APP_URL="https://<production-domain>"
BETTER_AUTH_URL="https://<production-domain>"
BETTER_AUTH_SECRET="<32+ byte random secret>"
RATE_LIMIT_SECRET="<separate 32+ byte random secret>"
# Enable only behind a proxy that overwrites forwarded client-IP headers.
TRUST_PROXY_HEADERS=true
TRUSTED_PROXY_HOPS=1
EMAIL_ENABLED=true
SMTP_HOST="<smtp host>"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="<smtp user>"
SMTP_PASSWORD="<smtp app password>"
EMAIL_FROM="CampusPulse <no-reply@<production-domain>>"
POSTER_STORAGE_DRIVER=s3
S3_ENDPOINT="<endpoint>"
S3_REGION="<region>"
S3_BUCKET="<private bucket>"
S3_ACCESS_KEY_ID="<key>"
S3_SECRET_ACCESS_KEY="<secret>"
# S3_SESSION_TOKEN="<token>"   # only when using temporary credentials
S3_ALLOW_INSECURE=false
S3_FORCE_PATH_STYLE=true
S3_PREFIX="posters"
```

Set `DATABASE_SSL=true` and `DATABASE_LOG_QUERIES=false` unless the provider's
requirements differ. Never enable query logging in production.

## 3. Build and test the release

Run from the release checkout:

```bash
npm ci
npm run db:generate
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

`npm run db:generate` must run before typecheck, tests, or a build in a fresh
checkout. `npm run build` has a `prebuild` hook that generates again, but the
earlier gates need the generated Prisma client too.

Expected Prompt 9 results:

- Typecheck: pass.
- Lint: pass.
- Format check: pass.
- Tests: 31 files / 235 tests pass.
- Build: pass; 42 static-generation units across all application routes.

On a memory-constrained build host, keep the default 2 workers or lower them:

```bash
NEXT_BUILD_CPUS=2 npm run build
```

Do not run the development seed in production. `db:seed` refuses
`NODE_ENV=production` and remote hosts.

## 4. Apply database migrations

Run migrations with the direct connection:

```bash
npx prisma migrate deploy
```

If the runtime image omits dev dependencies, run this from a release stage that
has the pinned `prisma` CLI available. Do not use `prisma migrate dev` against
production. Do not use `prisma db push`.

Verify:

```bash
npx prisma migrate status
```

Expected: 8 migrations found, database schema up to date. The Prompt 9
migration adds the `EXPORT_DOWNLOADED` audit enum value.

If a migration fails:

1. Stop the release.
2. Capture the migration name and error.
3. Do not edit the applied migration in place.
4. Restore from the pre-deployment backup if the schema is partially changed.
5. Fix forward with a new migration and re-verify on a staging database.

## 5. First-run bootstrap

The production database starts empty. Registration requires an active college,
and the platform dashboard does not expose tenant creation. Use the guarded
operational CLI:

```bash
npm run college:bootstrap -- \
  --confirm-college-bootstrap \
  --name "Example College" \
  --slug "example-college" \
  --short-name "EC" \
  --domain "example.edu" \
  --timezone "Asia/Kolkata"
```

This creates only the college. It does not create a user, password, or secret.
It refuses a duplicate slug or domain.

Then:

1. Start the application and open `/register`.
2. Register the initial account against the new college. Registration assigns
   `STUDENT`; email verification is not required for login in this
   configuration.
3. Promote the account to platform administrator:

```bash
npm run auth:bootstrap-super-admin -- initial-admin@example.edu --confirm-super-admin
```

4. Sign in again. Promotion revokes existing sessions.
5. Confirm the platform dashboard is reachable at `/platform`.

For additional colleges, rerun `college:bootstrap` with a new slug and domain.
There is currently no in-app college creation screen; this is a known product
gap, not a Prompt 9 regression.

## 6. Start the application

```bash
npm start -- --port 3000
```

Run it under a process supervisor (systemd, PM2, the platform's process
manager, or a container orchestrator). Requirements:

- `NODE_ENV=production`.
- The working directory contains `.next`, `node_modules`, `public`, and
  `prisma`.
- The process can reach PostgreSQL, object storage, and SMTP.
- The proxy forwards to the app port.
- The process is restarted on failure and started at boot.

Do not run `next dev` in production.

## 7. Post-deployment smoke tests

Run these in order and record the results.

### 7.1 Health

```bash
curl -i https://<domain>/api/health
```

Expected: `200`, `status: "ok"`, database latency present, `Cache-Control:
no-store`, no connection string in the body.

### 7.2 Security headers

```bash
curl -I https://<domain>/
```

Expected:

- `Strict-Transport-Security` present.
- `Content-Security-Policy` contains `nonce-` and `frame-ancestors 'none'`.
- `X-Frame-Options: DENY`.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` present.
- `Cross-Origin-Opener-Policy: same-origin`.
- No `X-Powered-By`.

### 7.3 Authentication

- Register a test student or use the bootstrap admin.
- Sign in and confirm the correct dashboard.
- Sign out and confirm the session cookie is cleared.
- Request a password reset and confirm the email arrives; complete the reset
  and sign in with the new password.

### 7.4 Tenant and role isolation

- Create or use two colleges.
- Confirm a user from college A cannot read college B's events, users, or
  exports.
- Confirm a student cannot open club, college, or platform dashboards.

### 7.5 Event and poster flow

- Create a club and an event as a club manager.
- Upload a JPEG/PNG/WebP poster.
- Run OCR and confirm a bounded result or a safe failure.
- Submit the event for approval, approve it as a college admin, and view it as a
  student.
- Replace and remove the poster; confirm old poster URLs return `404`.
- Confirm the poster object exists in the private bucket and is not publicly
  readable.

### 7.6 Exports and audit

- Download a club attendance CSV and a calendar ICS.
- Confirm the CSV starts with a UTF-8 BOM and uses CRLF line endings.
- Confirm the download response has `Cache-Control: no-store`.
- Confirm calendar downloads expose `X-Export-Row-Count` and
  `X-Export-Truncated`. Calendar exports are capped at 1,000 events; when the
  header is `true`, rows beyond the cap were intentionally omitted.
- Query the audit log for `EXPORT_DOWNLOADED` and confirm the actor, tenant,
  kind, format, scope, and row count are present, with no student names or roll
  numbers.
- Confirm the rate limiter table received rows.

### 7.7 Rate limits

- Exceed a low-risk limit in a staging environment (not production) and confirm
  `429` with `Retry-After`.
- Do not intentionally lock out real production users.

### 7.8 Storage and email failure behavior

- In staging, revoke the S3 key and confirm poster operations fail safely and
  do not corrupt event rows.
- In staging, stop SMTP and confirm the password-reset response stays generic
  and a `PASSWORD_RESET_FAILED` audit row is written.

## 8. Rollback

### Application rollback

1. Stop routing traffic to the new instance.
2. Start the previous release artifact.
3. Confirm `/api/health` returns `200`.
4. Confirm login, dashboard, and poster delivery.
5. Keep the failed instance's logs for diagnosis.

### Database rollback

Prompt 9's migration is additive (an enum value). Prefer fixing forward. If a
rollback is unavoidable:

1. Stop all application writes.
2. Restore the pre-deployment backup or use point-in-time recovery.
3. Run `npx prisma migrate status`.
4. Start the previous application version.
5. Re-run the smoke tests.

Do not run `prisma migrate reset` against production.

### Object storage rollback

- Poster objects are immutable by key; a failed release does not require
  deleting them.
- If versioning is enabled, restore the prior object version.
- If a bad cleanup deleted objects, restore from the bucket backup/versioning.

## 9. Post-deployment operations

- Schedule `db:prune-rate-limits` daily or weekly. If the runtime image lacks
  `tsx`, run the equivalent SQL from the operations runbook.
- Confirm database backups run and are monitored.
- Confirm the uptime check is green for 24 hours.
- Review the first day's 5xx rate, health latency, and database connections.
- Record the deployed revision, build time, migration version, and smoke-test
  results.

## 10. Deployment checklist

- [ ] Approval recorded.
- [ ] Domain and TLS ready.
- [ ] PostgreSQL provisioned with backups.
- [ ] S3 bucket private and scoped credentials created.
- [ ] SMTP verified.
- [ ] Monitoring and alerts configured.
- [ ] Environment values set in the secret manager.
- [ ] `npm ci`, `npm run db:generate`, typecheck, lint, format check, tests, and build pass.
- [ ] `prisma migrate deploy` succeeds.
- [ ] First college bootstrapped.
- [ ] Initial account registered.
- [ ] Super-admin bootstrap succeeds and sessions are re-established.
- [ ] Health, headers, auth, tenant isolation, posters, OCR, exports, audit,
      and email smoke tests pass.
- [ ] Rollback artifact and database backup confirmed.
- [ ] Deployment record written.

## 11. What is still blocked

- No production credentials, domain, hosting, database, bucket, or SMTP
  provider have been configured.
- No paid service has been selected or approved.
- No deployment, migration against production, or live smoke test has been
  performed.
- The S3 adapter and SMTP path have not been exercised against live services.

Do not report the deployment as complete until every item above is done and
the owner has approved the result.

## 12. References

- `docs/PROMPT_9_ENVIRONMENT_REFERENCE.md`
- `docs/PROMPT_9_PRODUCTION_ARCHITECTURE.md`
- `docs/PROMPT_9_BACKUP_AND_RECOVERY.md`
- `docs/PROMPT_9_OPERATIONS_RUNBOOK.md`
- `docs/PROMPT_9_VERIFICATION_REPORT.md`
- `docs/authentication.md`
- `docs/poster-storage.md`
