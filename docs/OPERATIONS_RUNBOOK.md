# Production Hardening — Operations Runbook

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Ready for a first deployment; no production environment is live

This runbook is for the operator on call. It covers routine checks, alerts, and
the most likely incidents. Thresholds marked “proposed” must be confirmed
against the hosting provider and the institution's service levels.

## 1. Service summary

| Item            | Value                                        |
| --------------- | -------------------------------------------- |
| Application     | Next.js 16.4.5 Node server, `next start`     |
| Default port    | 3000                                         |
| Health endpoint | `GET /api/health`                            |
| Database        | PostgreSQL                                   |
| Poster storage  | Local volume or private S3-compatible bucket |
| Email           | SMTP, password reset only                    |
| Sessions        | Database-backed, HTTP-only cookies           |
| Background jobs | None; OCR is synchronous and bounded         |
| Rate limiter    | PostgreSQL table                             |

## 2. Routine checks

### Daily

- [ ] `/api/health` returns `200` and database latency is within the expected
      range.
- [ ] No sustained `5xx` spike in the application logs.
- [ ] Database storage and connection count are below the provider limits.
- [ ] Object storage error rate is normal.
- [ ] Password-reset failures (`PASSWORD_RESET_FAILED`) are not elevated.
- [ ] No unexpected `429` spike for legitimate users.
- [ ] Backups ran successfully.

### Weekly

- [ ] Review audit log volume and any unusual admin actions.
- [ ] Review rate-limit table size.
- [ ] Review OCR failure/timeout counts.
- [ ] Confirm certificate expiry is more than 30 days away.
- [ ] Confirm the latest release is the intended revision.
- [ ] Run `npm run db:prune-rate-limits` or the SQL equivalent.

### Monthly

- [ ] Test a restore into an isolated environment (quarterly at minimum).
- [ ] Review database indexes and slow queries.
- [ ] Review dependency advisories and decide on upgrades.
- [ ] Review access to the hosting, database, bucket, and secret manager.
- [ ] Rotate credentials according to policy.
- [ ] Review audit retention with the institution.

## 3. Health checks

```bash
curl -fsS https://<domain>/api/health
```

Healthy response:

```json
{
  "status": "ok",
  "checkedAt": "2026-11-18T11:41:03.826Z",
  "uptimeSeconds": 15,
  "checks": { "database": { "status": "ok", "latencyMs": 2 } }
}
```

Unhealthy response: HTTP `503`, `status: "error"`, database status `"error"`.
The body never contains a connection string or stack trace.

Proposed alerts:

| Signal                | Threshold                           | Action                            |
| --------------------- | ----------------------------------- | --------------------------------- |
| Health check          | 3 consecutive failures or timeout   | Page on-call                      |
| Health latency        | Database probe > 1,000 ms for 5 min | Investigate database              |
| HTTP 5xx              | > 2% of requests for 5 min          | Investigate app/database          |
| p95 page latency      | > 2 s for 10 min                    | Check database and host CPU       |
| DB connections        | > 80% of limit                      | Check pool/leaks; scale           |
| DB storage            | > 80% of allocated                  | Clean/scale; review audit growth  |
| Object storage errors | > 1% for 5 min                      | Check credentials/bucket/provider |
| SMTP failures         | Any sustained failure               | Check provider/credentials        |

## 4. Incident: database unavailable

Symptoms:

- `/api/health` returns `503`.
- Pages and server actions fail.
- Login and other rate-limited actions are denied (fail closed).

Steps:

1. Confirm the provider status and the database host/port.
2. Check credentials and TLS settings; confirm no recent secret rotation.
3. Check connection count and storage; a full disk or exhausted connections can
   look like an outage.
4. If the provider is down, follow its status page and failover procedure.
5. If the database is reachable but slow, check long-running queries and locks.
6. Do not disable the rate limiter to “work around” the outage. It is failing
   closed by design.
7. After recovery, confirm health, login, and a representative dashboard.
8. Record the incident start/end, cause, and any data loss.

Do not run `prisma migrate reset` or delete the database to recover.

## 5. Incident: database connection exhaustion

Symptoms:

- Intermittent timeouts, `too many connections`, or high latency.
- Health probe may still succeed while pages fail.

Steps:

1. Check active connections by application and user.
2. Confirm the number of app instances and `DATABASE_POOL_MAX`.
3. Look for leaked clients or a runaway query.
4. Reduce instances or pool size temporarily if the provider limit is the
   constraint.
5. Restart an instance only after capturing diagnostics; a restart masks a leak.
6. Scale the database or add a pooler if the load is legitimate.

## 6. Incident: poster storage unavailable

Symptoms:

- Poster upload/replace/remove fails.
- Poster delivery returns `500` (unexpected) or `404` (missing).
- Event pages still render with the fallback.

Steps:

1. Check the bucket/volume status and the S3 provider status page.
2. Confirm `S3_*` values and key permissions.
3. Confirm the bucket is private and the prefix is correct.
4. For local storage, confirm the volume is mounted and writable by the app
   user.
5. Do not make the bucket public as a workaround.
6. After recovery, test upload, delivery, replacement, and removal.
7. Check for orphan objects if cleanup failed.

## 7. Incident: password-reset email failing

Symptoms:

- Users do not receive reset emails.
- `PASSWORD_RESET_FAILED` audit rows increase.
- The HTTP response remains generic by design.

Steps:

1. Check the SMTP provider status and credentials.
2. Confirm `EMAIL_ENABLED=true`, `SMTP_HOST`, `EMAIL_FROM`, and the credential
   pair.
3. Confirm SPF/DKIM/DMARC and sending limits.
4. Send a test reset to an internal address.
5. If the provider is down, use an approved administrative recovery procedure;
   do not reveal account existence.
6. After recovery, confirm a real reset completes.

## 8. Incident: OCR failures or CPU saturation

Symptoms:

- OCR requests time out or fail.
- Host CPU is saturated; other requests slow down.
- Users retry repeatedly.

Steps:

1. Check the OCR error/timeout count and the host CPU.
2. Confirm the per-user OCR limit is active.
3. Confirm the in-process concurrency guard is healthy: at most two OCR jobs run
   at once, up to eight wait, and a request waits at most 20 seconds before a
   safe `429` response.
4. Confirm the 60 s worker timeout, 65 s deadline, and 60 s failure cooldown are
   in the deployed build.
5. Reduce concurrent OCR load by asking users to retry later; the cooldown
   prevents immediate retries.
6. If OCR is routinely saturating the host, move it to a background worker or a
   larger instance. The current guard is per process, not a distributed queue.
7. Do not remove the timeout, concurrency guard, or rate limit to “fix” the symptom.

## 9. Incident: suspected credential attack

Symptoms:

- Many `LOGIN_FAILED` auth audit events.
- `429` responses from login.
- A single IP or email dominates attempts.

Steps:

1. Confirm the login rate limits are active (`5/15 min` per email, `20/15 min`
   per IP).
2. Review auth audit events and the source IPs (stored as HMAC digests).
3. Block the offending source at the proxy/WAF if available.
4. Do not disable the limiter.
5. If an account may be compromised:
   - Force a password reset; completing a reset revokes all sessions.
   - Review audit logs for that actor.
   - Notify the account owner through an approved channel.
6. If a super-admin account is compromised, use the CLI bootstrap procedure
   only after securing the account and rotating secrets.

## 10. Incident: compromised account or session

1. Disable the account through the college/platform user administration flow,
   or change its status to `DISABLED`/`SUSPENDED` as appropriate.
2. Force a password reset; completion revokes all sessions.
3. Review audit logs and auth audit events.
4. Rotate `BETTER_AUTH_SECRET` only if session integrity is in doubt; this may
   sign out all users.
5. Communicate according to the institution's incident policy.

## 11. Incident: migration failure

1. Stop the release; do not start the new app version.
2. Capture the migration name and error.
3. Do not edit an applied migration in place.
4. Restore the pre-deployment backup if the schema is partially changed.
5. Fix forward with a new migration and verify on staging.
6. Re-run `npx prisma migrate status` before retrying.

## 12. Incident: build out-of-memory

Symptoms:

- `next build` exits with `3221226505` or “JavaScript heap out of memory”.
- Failure occurs during “Collecting page data”.

Steps:

1. Check free memory on the build host.
2. Re-run with fewer workers:

```bash
NEXT_BUILD_CPUS=1 npm run build
```

3. Do not change application code first; this is usually worker concurrency.
4. Ensure the Tesseract adapter remains lazily imported.
5. On a larger CI runner, raise `NEXT_BUILD_CPUS` only after confirming memory
   headroom.

## 13. Maintenance commands

| Task                      | Command                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Check database            | `npm run db:health`                                                                   |
| Migration status          | `npx prisma migrate status`                                                           |
| Apply migrations          | `npx prisma migrate deploy`                                                           |
| Prune expired rate limits | `npm run db:prune-rate-limits`                                                        |
| Prune without `tsx`       | `psql "$DIRECT_URL" -c 'DELETE FROM "rate_limit_entries" WHERE "expiresAt" < now();'` |
| Bootstrap a college       | `npm run college:bootstrap -- --confirm-college-bootstrap ...`                        |
| Promote a super admin     | `npm run auth:bootstrap-super-admin -- <email> --confirm-super-admin`                 |
| Check health              | `curl -fsS https://<domain>/api/health`                                               |
| Run tests                 | `npm test`                                                                            |
| Run E2E                   | `npx playwright test`                                                                 |

The maintenance scripts require `tsx`/`prisma`, which are dev dependencies. If
the runtime image omits them, run the commands from a release/maintenance
environment with full dependencies, or use the SQL equivalent.

## 14. Audit and log handling

- Audit rows contain actor IDs, tenant IDs, action, entity, and redacted
  metadata.
- Export audit rows contain no student names, roll numbers, or file contents.
- Auth audit events store email/IP as HMAC digests.
- Do not enable `DATABASE_LOG_QUERIES` in production; query parameters can
  contain personal data.
- Do not paste full environment dumps into tickets.
- **Audit retention:** no automatic deletion job exists. Keep audit rows for the
  institution's approved records period; a starting proposal is 24 months for
  security/export events and 7 years where the institution treats them as
  governed records. The owner and privacy/legal contact must approve the period
  before any deletion. Prefer an append-only archive or cold storage over
  deleting rows. If retention is automated later, run a dry run, record the
  cutoff and count, and retain a backup. Never delete audit rows to hide an
  incident.
- Export audit metadata is intentionally limited to kind, format, scope, row
  count, and truncation flag; it must not be expanded to include student names,
  roll numbers, or file contents.

## 15. Orphan poster cleanup

There is no background garbage collector. Orphans can occur if old-file cleanup
fails after a successful database commit.

Manual review:

1. List poster rows and their storage keys.
2. List objects in the bucket/volume.
3. Identify objects with no matching row.
4. Confirm they are not referenced by a soft-deleted or historical record.
5. Delete only after review; do not delete objects referenced by any row.

Do not run an automated deletion without a dry-run and a backup.

## 16. Change management

- Record the revision, build time, migration version, and operator for every
  release.
- Use a maintenance window for migrations that lock large tables.
- Keep the previous release artifact available for rollback.
- Do not deploy uncommitted work.
- Re-run the smoke tests after every release.

## 17. Escalation

| Severity | Example                                             | Response                                                       |
| -------- | --------------------------------------------------- | -------------------------------------------------------------- |
| SEV-1    | Full outage, data loss, security breach             | Page incident lead immediately; status page; preserve evidence |
| SEV-2    | Major feature unavailable (posters, exports, email) | Respond within the agreed business hours; workaround           |
| SEV-3    | Degraded performance or single-user issue           | Normal support queue                                           |

Named contacts, phone numbers, and provider support tiers must be filled in by
the deployment owner. They are intentionally not invented here.

## 18. References

- `docs/DEPLOYMENT_GUIDE.md`
- `docs/BACKUP_AND_RECOVERY.md`
- `docs/RELIABILITY_REPORT.md`
- `docs/SECURITY_HARDENING.md`
- `docs/ENVIRONMENT_REFERENCE.md`
