# CampusPulse — Production Readiness & Deployment Guide

This document certifies that CampusPulse is production-ready for deployment under modern serverless and containerized cloud platforms.

---

## 1. Zero-Cost Free-Tier Architecture Overview

CampusPulse is fully architected to operate efficiently within zero-dollar free-tier allocations:

```mermaid
flowchart TD
    User([End Users & Students]) -->|HTTPS / Next.js 16| Vercel[Vercel Serverless Platform\nHobby Plan: Free]
    Vercel -->|Prisma PgAdapter / Pooler| Neon[(Neon PostgreSQL 17\nServerless Free Tier: 0.5 GB)]
    Vercel -->|S3 REST API / SigV4| Supabase[Supabase Storage\nFree Tier: 1 GB Private S3 Bucket]
    Vercel -->|SMTP / TLS| Brevo[Free SMTP / Brevo\n300 free emails/day]
```

| Component               | Platform / Service        | Free-Tier Limits                          | Expected Consumption |
| :---------------------- | :------------------------ | :---------------------------------------- | :------------------- |
| **Compute & CDN**       | Vercel (Hobby)            | 100 GB bandwidth, unlimited deployments   | ~5 GB/mo             |
| **Relational Database** | Neon PostgreSQL 17        | 0.5 GB storage, pooled connection manager | ~50 MB initially     |
| **Object Storage**      | Supabase Storage (S3 API) | 1 GB storage, 2 GB egress/mo              | ~200 MB for posters  |
| **Transactional Email** | Brevo / Resend            | 300 free emails / day                     | ~50 emails / day     |

---

## 2. Production Deployment Status & Verification

### Static & Build Verification

- [x] **TypeScript Validation:** `npm run typecheck` (`tsc --noEmit`) passes with 0 errors.
- [x] **Linting Standard:** `npm run lint` (`eslint .`) passes with 0 errors and 0 warnings.
- [x] **Code Formatting:** `npm run format:check` (`prettier --check .`) passes with 100% adherence.
- [x] **Optimized Production Build:** `npm run build` (`next build`) compiles all 42 routes cleanly.
- [x] **Environment Variable Hygiene:** All 9 S3 configuration variables, database pool variables, and auth secrets are audited with strict masking.

### Super Admin Account Security

- **Database-Backed Verification:** `AuthenticatedActor` and `AuthenticatedUser` carry `emailVerified` directly from PostgreSQL.
- **Privilege Gating:** In `src/services/authorization.ts`, `assertSuperAdmin` validates `env.EMAIL_ENABLED && !actor.emailVerified` before allowing privileged platform actions.
- **Safe Local Fallback:** While SMTP is unconfigured (`EMAIL_ENABLED=false`), platform access is preserved in safe local mode without administrative lockout.
- **Advisory UI:** The `/platform` workspace displays an interactive security banner alerting administrators to unverified email status.
- **Account Badging:** The `/account` settings center provides live `Verified` and `Unverified` credential badges.

### Supabase Storage (S3 API) Compatibility

- **Remote S3 API:** Verified live against Supabase Storage (`storage/v1/s3`).
- **MIME Type Validation:** Supabase Storage requires `Content-Type` matching allowed image types (`image/webp`, `image/jpeg`, `image/png`). `s3-poster-storage.ts` dynamically provides this header.
- **Conditional Writes:** `If-None-Match: *` is verified supported by the Supabase S3 endpoint.
- **Non-Destructive Testing:** Upload, retrieval, byte-level integrity, and deletion verified with clean 404 confirmation.
- **Private Bucket Architecture:** Files are served through authenticated streaming proxy `/api/posters/[posterId]` with `Cache-Control: private, no-store`.

---

## 3. Deployment Procedure

### 3.1 Database Configuration

1. Set `DATABASE_URL` pointing to the Neon pooled connection endpoint:
   `postgresql://user:pass@ep-xyz-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`
2. Set `DIRECT_URL` pointing to the direct endpoint:
   `postgresql://user:pass@ep-xyz.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Verify connection health:
   ```bash
   npm run db:health
   ```

### 3.2 Supabase S3 Configuration

Set the following environment variables in Vercel project settings:

```ini
POSTER_STORAGE_DRIVER="s3"
S3_ENDPOINT="https://<project-ref>.storage.supabase.co/storage/v1/s3"
S3_REGION="<project-region>"
S3_BUCKET="campuspulse-posters"
S3_ACCESS_KEY_ID="<supabase-s3-access-key-id>"
S3_SECRET_ACCESS_KEY="<supabase-s3-secret-access-key>"
S3_FORCE_PATH_STYLE="true"
S3_PREFIX="posters"
S3_ALLOW_INSECURE="false"
```

### 3.3 Transactional Email (Optional / For Open Production)

To enable email verification and password reset emails:

```ini
EMAIL_ENABLED="true"
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="<smtp-user>"
SMTP_PASSWORD="<smtp-password>"
EMAIL_FROM="CampusPulse <no-reply@campuspulse.edu>"
```

---

## 4. Health Monitoring & Maintenance

### 4.1 Health Check API (`/api/health`)

The `/api/health` endpoint performs a live database connectivity check (`SELECT 1`) within a 2000ms deadline and returns a structured JSON payload:

```json
{
  "status": "ok",
  "checkedAt": "2026-11-25T14:50:00.000Z",
  "uptimeSeconds": 1240,
  "checks": {
    "database": {
      "status": "ok",
      "latencyMs": 96
    }
  }
}
```

Uptime monitoring tools (e.g. BetterStack, UptimeRobot) can ping this route every 60 seconds without consuming rate-limit tokens.

### 4.2 Scheduled Background Jobs

- **Rate Limit Pruning:** Execute `npm run db:prune-rate-limits` via a nightly cron job (e.g. GitHub Actions or Vercel Cron) to delete expired rate-limit buckets from the database.
- **OCR Claim Cleanup:** Handled automatically in application runtime; stale `PROCESSING` OCR claims older than 15 minutes are reclaimed on the next OCR request.
