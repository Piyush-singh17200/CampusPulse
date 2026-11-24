# Production Hardening — Backup and Recovery

**Project:** CampusPulse
**Date:** 18 November 2026
**Status:** Runbook ready; no production backup or restore drill has been performed

This document defines what must be backed up, proposed recovery objectives, and
the procedures to restore a CampusPulse deployment. The targets below are
proposals for the owner to approve; they are not measured production results.

## 1. What must be protected

| Asset                | Location                                          | Loss impact                                                                                                                          |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL database  | Managed database or self-hosted volume            | All accounts, colleges, clubs, events, registrations, attendance, feedback, notifications, sessions, audit logs, rate-limit counters |
| Poster objects       | S3-compatible bucket or local volume              | Event poster images; event pages fall back if missing                                                                                |
| Secrets              | Secret manager / password manager                 | Inability to start or authenticate; loss of SMTP/S3/database access                                                                  |
| Application artifact | Release registry or build output                  | Inability to redeploy the same revision                                                                                              |
| Configuration        | Infrastructure-as-code or documented env contract | Slow or incorrect rebuild                                                                                                            |
| DNS/TLS records      | DNS provider / certificate manager                | Outage or certificate expiry                                                                                                         |

The PostgreSQL database is the source of truth for poster metadata. Poster
objects are referenced by storage key; a database restore without the matching
objects produces broken posters, and objects without database rows are orphans.

## 2. Proposed objectives

These are starting targets, not guarantees:

| Objective                      | Proposal                                                           | Notes                                                       |
| ------------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Recovery point objective (RPO) | 24 hours with daily backups; 5 minutes if the provider offers PITR | PITR is strongly preferred for production                   |
| Recovery time objective (RTO)  | 4 hours for a single-instance pilot                                | Depends on provider restore speed and operator availability |
| Backup retention               | 7 daily, 4 weekly, 12 monthly                                      | Adjust to the institution's policy                          |
| Restore drill frequency        | Quarterly, and before the first production launch                  | A backup is not verified until it has been restored         |

If the institution has a stricter records policy, the stricter policy wins.

## 3. PostgreSQL backups

### 3.1 Managed provider

Prefer the provider's automated backups and point-in-time recovery. Confirm:

- Automated backups are enabled.
- The retention window meets the RPO.
- PITR is enabled if the RPO is shorter than the backup interval.
- Backups are encrypted at rest and in transit.
- Restores can be performed into a separate instance without overwriting
  production.
- The backup schedule and retention are documented in the provider console.

### 3.2 Self-hosted PostgreSQL

Use `pg_dump` in custom format plus WAL archiving if PITR is required.

Daily logical backup:

```bash
pg_dump \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file="campuspulse-$(date +%Y%m%dT%H%M%S).dump" \
  "$DIRECT_URL"
```

Verify the archive can be listed:

```bash
pg_restore --list campuspulse-YYYYMMDDTHHMMSS.dump | head
```

Store backups encrypted, outside the application host, with at least one copy
in a different failure domain. Do not store the only copy on the same disk as
the database.

### 3.3 Retention

A reasonable starting policy:

- Keep 7 daily backups.
- Keep 4 weekly backups.
- Keep 12 monthly backups.
- Expire backups automatically only after the retention policy is approved.
- Keep the pre-deployment backup until the release has been stable for at least
  one week.

## 4. Poster object backups

### 4.1 S3-compatible storage

- Enable bucket versioning if the provider supports it.
- Add a lifecycle rule to expire noncurrent versions after the approved period.
- Enable replication or a scheduled copy to a second bucket/region if the
  institution requires geographic redundancy.
- Keep the bucket private; backups must not create a public copy.
- Record the bucket, prefix, versioning setting, and lifecycle rule in the
  deployment record.

### 4.2 Local storage

- Back up the entire `POSTER_STORAGE_DIR` (default `.data/posters`) on the same
  schedule as the database.
- Use a filesystem snapshot or `rsync`/`restic` to a separate host.
- Ensure the backup captures file permissions and the directory structure.
- Do not serve the backup directory publicly.

### 4.3 Consistency

The database and poster storage should be backed up close together. A small
time skew can produce a database row whose object is missing, or an object
whose row is absent. Both are recoverable:

- Missing object: delivery returns `404`; the event page shows the fallback.
- Orphan object: harmless storage cost; clean up with a reconciliation job.

## 5. Secrets and configuration

Back up the following in a password manager or secret manager, not in the
database backup:

- `BETTER_AUTH_SECRET`
- `RATE_LIMIT_SECRET`
- Database credentials
- S3 access key and secret
- SMTP credentials
- DNS provider credentials or recovery codes
- TLS certificate/private key or ACME account recovery information

Record the environment contract (variable names, not secret values) in the
deployment record. If a secret is lost, rotate it rather than trying to recover
it from a backup.

## 6. Restore procedure — PostgreSQL

### 6.1 Prepare

1. Declare an incident and stop application writes.
2. Identify the target recovery point.
3. Provision an empty database or a separate restore instance.
4. Confirm the PostgreSQL version matches the source.
5. Keep the failed database available for diagnosis; do not overwrite it
   immediately.

### 6.2 Restore

For a custom-format dump:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$RESTORE_DATABASE_URL" \
  campuspulse-YYYYMMDDTHHMMSS.dump
```

For a managed PITR restore, use the provider's console/API to restore to a new
instance at the chosen timestamp. Do not restore over the live instance.

### 6.3 Verify

```bash
psql "$RESTORE_DATABASE_URL" -c 'select count(*) from colleges;'
psql "$RESTORE_DATABASE_URL" -c 'select count(*) from users;'
psql "$RESTORE_DATABASE_URL" -c 'select count(*) from events;'
psql "$RESTORE_DATABASE_URL" -c 'select count(*) from audit_logs;'
```

Then, with the application pointed at the restored database in a staging
environment:

```bash
npx prisma migrate status
```

Expected: all migrations applied, no pending migrations.

Smoke-test:

- Sign in with a known account.
- Open the student discover page.
- Open a club dashboard and an event detail page.
- Download an attendance CSV.
- Open a poster (if the object store is also restored).
- Check `/api/health`.

### 6.4 Cut over

1. Update `DATABASE_URL` and `DIRECT_URL` to the restored database.
2. Restart the application.
3. Confirm health and smoke tests.
4. Resume writes.
5. Record the recovery point, restore duration, and any data loss.

## 7. Restore procedure — poster storage

### 7.1 S3 versioning

1. Identify the affected object keys from the database.
2. Restore the prior object version or copy it from the backup bucket.
3. Confirm the object is private.
4. Open the poster through the authenticated route.

### 7.2 Local volume

1. Stop the application.
2. Restore the `POSTER_STORAGE_DIR` from the snapshot/backup.
3. Confirm ownership and permissions allow the app user to read/write.
4. Start the application.
5. Open a known poster and a missing-poster fallback.

## 8. Restore drill

A restore is not verified until it has been performed. The drill should:

1. Use a separate, isolated database (never production).
2. Restore the most recent backup.
3. Run `prisma migrate status`.
4. Start a staging app against the restored database.
5. Run the smoke tests in §6.3.
6. Measure the time from “start restore” to “smoke tests pass”.
7. Record the result, including any missing objects or migration drift.
8. Delete the drill database and staging app when finished.

**Status:** not performed. This is a launch blocker for a production rollout
with availability requirements.

## 9. Disaster scenarios

| Scenario                  | Recovery approach                                              | Data loss                         |
| ------------------------- | -------------------------------------------------------------- | --------------------------------- |
| Accidental row deletion   | PITR to just before the deletion, or restore + targeted repair | Up to the PITR window             |
| Failed migration          | Restore pre-deployment backup; fix forward on staging          | Since the backup                  |
| Database corruption       | Provider restore/PITR                                          | Up to the RPO                     |
| Object storage deletion   | Versioning restore or backup copy                              | Since the backup/version          |
| Lost S3 credentials       | Rotate keys; no data loss                                      | None                              |
| Lost `BETTER_AUTH_SECRET` | Rotate; users may need to sign in again                        | Sessions only                     |
| Lost SMTP credentials     | Rotate; password-reset delivery resumes                        | None                              |
| Lost application artifact | Rebuild from the recorded revision                             | None if the revision is available |
| Region/provider outage    | Fail over to the secondary region/provider if configured       | Up to the replication lag         |

## 10. Responsibilities

| Task                                     | Owner                         |
| ---------------------------------------- | ----------------------------- |
| Approve RPO/RTO and retention            | Institution owner             |
| Configure provider backups/PITR          | Infrastructure owner          |
| Run and record restore drills            | Operations owner              |
| Rotate secrets                           | Security/infrastructure owner |
| Verify poster storage backups            | Infrastructure owner          |
| Declare a disaster and authorize restore | Incident lead                 |

## 11. References

- `docs/DEPLOYMENT_GUIDE.md`
- `docs/OPERATIONS_RUNBOOK.md`
- `docs/ENVIRONMENT_REFERENCE.md`
- `docs/PRODUCTION_ARCHITECTURE.md`
- `docs/database.md`
