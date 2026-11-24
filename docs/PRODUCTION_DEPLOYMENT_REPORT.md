# CampusPulse — Production Deployment Architecture & Execution Plan

**Project:** CampusPulse — Multi-Tenant Campus Event Operations Platform  
**Target Infrastructure Budget:** ₹0 / month (Zero-Cost Infrastructure Constraint)  
**Evaluated Branch:** `main` (Base HEAD: `daaf99dbff3a7b9c443ab94efd662896a16914db`)  
**Assessment Date:** 24 November 2026  
**Status:** **AWAITING OWNER APPROVAL PRIOR TO PROVISIONING & DEPLOYMENT**

---

## 1. Zero-Cost (₹0) Infrastructure Comparison & Selection

To fulfill the non-negotiable **₹0/month budget** constraint while preserving all existing application capabilities (including Next.js 16 Server Actions, Prisma multi-tenancy, and Tesseract.js OCR processing), cloud providers were audited against their official free-tier limits:

### 1.1 Application Hosting

| Provider                        | Free Tier Limits                                              | Strengths                                                                                 | Risk / Consideration for CampusPulse                                                                                                                 | Verdict                                           |
| :------------------------------ | :------------------------------------------------------------ | :---------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ |
| **Vercel** _(Hobby)_            | 100 GB bandwidth, Serverless functions, 15s execution timeout | Native Next.js 16 support, instant edge routing, free `*.vercel.app` subdomain            | **15-second serverless timeout:** If Tesseract OCR takes longer than 15s on large images, the function will timeout. Requires S3 driver for posters. | **Recommended for Web & APIs** (with bounded OCR) |
| **Render** _(Free Web Service)_ | 750 hours/month, 512 MB RAM, persistent environment           | Persistent Node.js process; no 15s serverless timeout for OCR; supports local disk volume | **Inactivity sleep:** Container sleeps after 15 minutes of inactivity; 50-second cold start on first visit.                                          | **Viable Alternative**                            |
| **Railway / Koyeb**             | Koyeb free tier (512 MB RAM, 1 nano service)                  | Runs Docker or Node.js persistently                                                       | Limited compute; memory pressure under heavy OCR workloads.                                                                                          | Backup Option                                     |

---

### 1.2 PostgreSQL Database Hosting

| Provider            | Free Tier Allocation                               | Pooled Connection Support                                  | Inactivity / Sleep Policy                                   | Verdict                                        |
| :------------------ | :------------------------------------------------- | :--------------------------------------------------------- | :---------------------------------------------------------- | :--------------------------------------------- |
| **Neon.tech**       | **0.5 GB storage**, 1 project, autoscaling compute | **Built-in PgBouncer pooler** (`-pooler` URL on port 5432) | Wakes up in ~500 ms; never permanently paused               | **SELECTED (Optimal for Next.js & Prisma)**    |
| **Supabase**        | 0.5 GB storage, 2 projects                         | Built-in Supavisor pooler                                  | Pauses after 7 days of inactivity (requires manual unpause) | Alternative                                    |
| **Render Postgres** | 1 GB storage                                       | No connection pooler                                       | **Free databases expire after 30 days!**                    | **REJECTED** (Unsafe for permanent production) |

---

### 1.3 Object Storage (Event Posters)

| Provider               | Free Tier Allocation                           | Egress Fee                | S3 API Compatibility                 | Verdict                                |
| :--------------------- | :--------------------------------------------- | :------------------------ | :----------------------------------- | :------------------------------------- |
| **Cloudflare R2**      | **10 GB storage / month**, 10M read operations | **₹0 (Zero egress fees)** | 100% S3-compatible (SigV4 supported) | **SELECTED (Zero egress costs)**       |
| **AWS S3 Free Tier**   | 5 GB storage for 12 months                     | Charged after free tier   | Native                               | Expiration risk after 12 months        |
| **Local Disk Storage** | Host disk bound                                | ₹0                        | Direct filesystem                    | Feasible only on persistent containers |

---

### 1.4 Outbound Email Delivery

| Provider               | Free Tier Allocation                 | Protocol            | Verdict                      |
| :--------------------- | :----------------------------------- | :------------------ | :--------------------------- |
| **Resend**             | **3,000 emails / month** (100 / day) | SMTP & REST API     | **SELECTED**                 |
| **Brevo (Sendinblue)** | 300 emails / day                     | SMTP                | Alternative                  |
| **Local Console Mode** | Unlimited (`EMAIL_ENABLED=false`)    | Console / Audit log | **Zero-Dependency Fallback** |

---

## 2. Selected ₹0 Production Architecture

```
                                 [ User Browser / Mobile ]
                                             │
                                   HTTPS / TLS (Zero-Cost)
                                             │
                        ┌────────────────────▼────────────────────┐
                        │      Vercel (Hobby Tier — ₹0/mo)        │
                        │    Next.js 16 App Router + Turbopack    │
                        │        (https://<app>.vercel.app)       │
                        └─────────────┬─────────────────┬─────────┘
                                      │                 │
                Pooled PostgreSQL Connection            │ S3 API (SigV4)
                                      │                 │
                        ┌─────────────▼─────────┐ ┌─────▼────────────────┐
                        │  Neon.tech PostgreSQL │ │ Cloudflare R2 Storage│
                        │  (0.5 GB Free Tier)   │ │  (10 GB Free Tier)   │
                        │  - Composite FKs      │ │  - Event Posters     │
                        │  - Rate Limit Tables  │ │  - ₹0 Egress Fees    │
                        └───────────────────────┘ └──────────────────────┘
```

---

## 3. Production Environment Configuration Checklist

All production variables must be configured securely in the hosting provider's environment settings (never committed to Git):

```dotenv
# ==============================================================================
# CAMPUSPULSE PRODUCTION ENVIRONMENT CONFIGURATION
# ==============================================================================
NODE_ENV="production"

# Database Connections (Neon Serverless Postgres)
DATABASE_URL="postgresql://<user>:<password>@ep-<pooler-id>-pooler.<region>.neon.tech/campuspulse?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@ep-<pooler-id>.<region>.neon.tech/campuspulse?sslmode=require"

# Application Base URLs
NEXT_PUBLIC_APP_URL="https://<your-subdomain>.vercel.app"
BETTER_AUTH_URL="https://<your-subdomain>.vercel.app"

# Cryptographic Secrets (32-byte hex strings generated via crypto.randomBytes(32))
BETTER_AUTH_SECRET="<generate_64_character_hex_string>"
RATE_LIMIT_SECRET="<generate_separate_64_character_hex_string>"

# Storage Driver (Cloudflare R2)
POSTER_STORAGE_DRIVER="s3"
S3_ENDPOINT="https://<cloudflare_account_id>.r2.cloudflarestorage.com"
S3_REGION="auto"
S3_BUCKET="campuspulse-posters"
S3_ACCESS_KEY_ID="<cloudflare_r2_access_key>"
S3_SECRET_ACCESS_KEY="<cloudflare_r2_secret_key>"
S3_FORCE_PATH_STYLE="true"
S3_ALLOW_INSECURE="false"

# Reverse Proxy Security
TRUST_PROXY_HEADERS="true"
TRUSTED_PROXY_HOPS="1"

# Email Configuration (Optional — Resend or Console Fallback)
EMAIL_ENABLED="false"
EMAIL_FROM="CampusPulse <no-reply@<your-subdomain>.vercel.app>"
```

---

## 4. Production Database Deployment & Bootstrap Procedure

When deploying to the live production database for the first time:

### Step 1: Apply Applied Database Migrations

Execute against the production database direct URL:

```powershell
npx prisma migrate deploy
```

_Applies all 8 migrations transactionally without altering local development or test databases._

### Step 2: Bootstrap Initial Institutional Tenant

Because production starts empty and registration requires an active college:

```powershell
npm run college:bootstrap -- `
  --confirm-college-bootstrap `
  --name "Apex Engineering University" `
  --slug "apex-engineering" `
  --short-name "AEU" `
  --domain "apex.edu" `
  --timezone "Asia/Kolkata"
```

### Step 3: Bootstrap Super Administrator

Promote the initial administrator account securely via the CLI tool:

```powershell
npm run auth:bootstrap-super-admin -- admin@apex.edu
```

---

## 5. Backup, Rollback & Disaster Recovery Procedures

1. **Database Point-in-Time Recovery:**
   - Neon maintains continuous Write-Ahead Log (WAL) branching. An instant snapshot or branch can be restored in seconds without data loss.
2. **Application Rollback:**
   - In Vercel, previous deployments remain stored as immutable deployment artifacts. Rolling back takes one click (**Promote to Production**) and completes in under 3 seconds.
3. **Database Migration Safety:**
   - All migrations in `prisma/migrations` are additive. No destructive schema drops (`DROP TABLE`, `DROP COLUMN`) exist in the current migration tree.

---

## 6. Pre-Deployment Owner Approval Boundary

Under the mandatory repository safety guidelines:

> [!IMPORTANT]
> **Owner approval is required before:**
>
> 1. Creating external cloud resources (Neon database, Cloudflare R2 bucket, Vercel project).
> 2. Running production migrations against an external cloud database.
> 3. Committing and pushing local changes to GitHub (`Piyush-singh17200/CampusPulse` on branch `main`).
