# CampusPulse Submission Guide

**Submission status:** **SUBMISSION READY WITH LIMITATIONS**  
**Verified:** 22 November 2026  
**Repository state:** uncommitted working tree on `main`, based on `daaf99dbff3a7b9c443ab94efd662896a16914db`  
**Product status:** locally runnable, database-backed, and demonstrable end to end.

---

## 1. Project introduction

**CampusPulse** is a full-featured, multi-tenant campus event discovery, moderation, and operations platform. It addresses the chaotic landscape of college event marketing: boards cluttered with physical flyers, fractured WhatsApp/Telegram announcements, uncontrolled spreadsheet signups, and lack of administrative oversight.

The project is built on Next.js 16, PostgreSQL 17, Prisma ORM, and Better Auth. It replaces fragmented workflows with a cohesive SaaS platform serving four core roles: Students, Club Administrators, College Administrators, and Super Administrators.

---

## 2. Problem statement

Campuses face a systemic information problem summarized by the platform tagline:

> **“CampusPulse — Too Many Posters, Too Little Signal.”**

1. **For Students:** Physical posters and social media announcements are scattered across campus walls, notice boards, and chat groups. Students miss hackathons, workshops, and club activities aligned with their specific interests because there is no unified, verified schedule.
2. **For Clubs:** Student clubs struggle with repetitive manual operations: creating promotional materials, re-entering details across multiple forms, managing check-ins with fragile paper sheets or Google Forms, and lacking meaningful attendance and feedback metrics.
3. **For College Administrators:** Deans and student-affairs coordinators cannot supervise campus activities effectively. Events are published without moderation, overlapping venue schedules cause room conflicts, and colleges lack an immutable audit trail of campus life.
4. **For Multi-Campus Networks:** Higher-education institutions operating multiple constituent colleges lack central visibility over college lifecycles, user growth, and network-wide compliance.

---

## 3. Solution overview

CampusPulse delivers an end-to-end, multi-college platform providing:

- **A Moderated Editorial Feed:** Every published event is verified by college administrators before appearing in the campus discovery stream.
- **Strict Multi-Tenancy:** Composite foreign keys and application-layer actor verification guarantee that students, clubs, and college admins only access data within their own college.
- **Smart Event Operations:** Poster uploads with automated local Tesseract.js OCR extraction, human review, QR attendance passes, manual check-in fallbacks, and authenticated ICS calendar feeds.
- **Event Intelligence:** Deterministic recommendation scoring, strict schedule-conflict warnings for overlapping events, and advisory duplicate-event detection for college administrators.
- **Closed-Loop Feedback & Analytics:** 30-day verified student feedback with college-level moderation, and database-aggregated engagement analytics with formula-safe CSV exports.
- **Four Distinct Role Workspaces:** Dedicated, context-rich dashboards designed specifically for Student discovery, Club operations, College governance, and Platform network oversight.

---

## 4. Target users

| Role                      | Primary User Persona                                      | Core Motivations & Goals                                                                                                                                   |
| :------------------------ | :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Student**               | Enrolled undergraduate/graduate student                   | Discover relevant events, register instantly, avoid schedule conflicts, receive QR attendance tickets, and download `.ics` calendar schedules.             |
| **Club Administrator**    | Student club president or authorized officer              | Draft and publish events, extract poster data via OCR, check in attendees via camera QR scanner or manual tokens, and export attendance records.           |
| **College Administrator** | Faculty advisor, dean of student affairs, campus director | Review pending event submissions, verify room and schedule availability, inspect advisory duplicates, moderate feedback, and monitor college audit trails. |
| **Super Administrator**   | Platform operator, university system IT administrator     | Oversee cross-campus college lifecycles, monitor network health and storage drivers, manage institutional staff, and review global audit events.           |

---

## 5. Major features

1. **Editorial Public Experience:**
   - Visual landing page communicating the core message: _"CampusPulse — Too Many Posters, Too Little Signal."_
   - Interactive 4-role product showcase illustrating discovery, operations, moderation, and network oversight.
   - Fully responsive layouts tested from 360 px up to 1440 px with zero horizontal overflow.

2. **Student Discovery & Event Journey:**
   - Personalized discovery feed filtered by category, date range, and search terms.
   - Deterministic event recommendations powered by explicit student interests, category affinity, timing, and popularity.
   - Schedule-conflict warnings highlighting overlapping registrations using strict interval logic.
   - Single-click registration, cancellation with automatic capacity release, and private saved-event bookmarks.
   - Event-bound QR attendance pass generation.
   - Post-event ratings and comments (30-day window for verified attendees).
   - In-app notification center with category filtering, unread badges, and deep links.
   - Authenticated `.ics` calendar export for single events, registered events, and saved events.

3. **Club Event Lifecycle & Operations:**
   - Multi-stage event lifecycle: `DRAFT` → `PENDING_APPROVAL` → `PUBLISHED` / `REJECTED` → `COMPLETED` / `CANCELLED`.
   - Poster management: upload, preview, replacement, and removal supporting JPEG, PNG, and WebP up to 5 MB.
   - Designed poster fallback ensuring aesthetic presentation when no poster is uploaded.
   - Local Tesseract.js OCR engine extracting event metadata with field-by-field human review.
   - Real-time attendance check-in via device camera QR scanner or manual token fallback with reasoned correction auditing.
   - Real-time engagement analytics (registrations, attendance rates, net satisfaction, category trends).
   - Formula-injection-safe CSV exports with RFC 4180 compliance, UTF-8 BOM, and CRLF row terminators.

4. **College Governance & Administration:**
   - Moderation approval queue with mandatory rejection reasons and transactional notifications.
   - Advisory duplicate detection scoring same-day, same-venue, and similar-title events.
   - Feedback moderation allowing college admins to hide abusive reviews while preserving immutable audit logs.
   - College user and club management with role assignment and session revocation.
   - Redacted, paginated tenant audit log.

5. **Platform Accountability & Network Health:**
   - Multi-college directory and lifecycle management (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
   - Platform-wide aggregate metrics (colleges, clubs, events, users, registrations).
   - Safe operational settings page inspecting storage adapter status and database connectivity without leaking credentials.
   - CLI-only bootstrap for super administrator accounts with Argon2id password hashing.

---

## 6. Technology stack

| Layer              | Technologies Used                      | Justification & Architecture Notes                                                                                            |
| :----------------- | :------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Framework**      | Next.js 16.4.5 (App Router, Turbopack) | Server Components by default; Server Actions for atomic mutations; static generation for 42 routes.                           |
| **Language**       | TypeScript 5 (Strict Mode)             | Zero `any` types; complete end-to-end type safety between database schema, services, and UI.                                  |
| **Database**       | PostgreSQL 17 (Docker container)       | Multi-tenant schema with 27 models, composite foreign keys, enum constraints, and partial unique indexes.                     |
| **ORM**            | Prisma 7.10.1                          | Type-safe query client generated to `src/generated/prisma`; 8 applied migrations.                                             |
| **Authentication** | Better Auth 1.7.18 + Argon2id          | Server-side database sessions, HttpOnly/SameSite/Secure cookies, single-use hash reset tokens, CSRF protection.               |
| **Validation**     | Zod 3.24                               | Schema validation on all environment variables, service inputs, form payloads, and API requests.                              |
| **OCR Engine**     | Tesseract.js (bundled English model)   | Server-only, bounded local OCR execution with concurrency slot limits (max 2 concurrent, 8 queued, 20s timeout).              |
| **Storage**        | Dual Storage Driver (Local + S3)       | Local filesystem adapter for local development/single-instance pilots; SigV4 S3 adapter for multi-instance cloud deployments. |
| **Styling**        | Tailwind CSS + Lucide Icons            | Responsive utility styling, design system tokens, accessible contrast, and smooth micro-interactions.                         |
| **Testing**        | Vitest 5.1.0 + Playwright              | 31 test files / 235 unit & integration tests; isolated test database `campuspulse_test`.                                      |

---

## 7. System architecture

```
               [ Browser / Mobile Client ]
                           │
                 HTTPS / Same-Origin
                           │
                 ┌─────────▼─────────┐
                 │  Next.js 16 Proxy │ (Security Headers, CSP,
                 │   & Page Guard    │  Forwarded IP Sanitize)
                 └─────────┬─────────┘
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
      [ Public Pages ] [ Auth ]  [ Dashboards ]
      - Landing        - Login   - /student
      - Register       - Reset   - /club
                                 - /college
                                 - /platform
                           │
                 ┌─────────▼─────────┐
                 │ AuthenticatedActor│ (Session verified, fresh
                 │  Security Context │  user & role reload)
                 └─────────┬─────────┘
                           │
                 ┌─────────▼─────────┐
                 │  Domain Services  │ (Lifecycle, Registration,
                 │  & Rate Limiters  │  Attendance, OCR, Feedback)
                 └─────────┬─────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   [ PostgreSQL 17 ]  [ Poster Storage ] [ Tesseract OCR ]
   - Composite FKs    - Local Adapter    - Bounded Workers
   - Row-level Locks  - S3-compatible    - Stale Recovery
   - Audit Redaction
```

---

## 8. User roles and permissions

CampusPulse implements strict Role-Based Access Control (RBAC). Roles are always validated server-side from PostgreSQL sessions, never from client-provided headers or cookies.

1. **STUDENT:**
   - Access to `/student/**`.
   - Read published events in own college.
   - Register and cancel own registrations.
   - Submit feedback for verified attended events.
   - Access own attendance QR pass.
   - Cannot access club management, approvals, or platform screens.

2. **CLUB_ADMIN:**
   - Access to `/club/**`.
   - Create, edit, submit, cancel, and complete events for managed clubs.
   - Upload and replace posters; request OCR extraction.
   - View attendee roster; scan QR codes and record reasoned corrections.
   - View feedback and analytics for managed clubs.
   - Scoped strictly to clubs where user has active `PRESIDENT` or `OFFICER` membership.

3. **COLLEGE_ADMIN:**
   - Access to `/college/**`.
   - Approve or reject event submissions across all clubs in own college.
   - Review advisory duplicate event suggestions.
   - Moderate student feedback (hide/restore) with mandatory audit entries.
   - Manage college users and club rosters.
   - Inspect college-scoped audit history.

4. **SUPER_ADMIN:**
   - Access to `/platform/**`.
   - Manage college lifecycles across the entire network.
   - View platform-wide aggregated analytics and operational health.
   - Inspect global audit logs.
   - Provisioned exclusively via secure CLI bootstrap script.

---

## 9. Main workflows

### Workflow A: Event Creation, OCR & Publishing

```
Club Manager: Creates Event Draft → Uploads Poster Image (JPEG/PNG/WebP)
        │
        ▼
Server: Content-signature validation → Stores file → Saves Poster row
        │
        ▼
Club Manager: Triggers OCR Extraction → Tesseract analyzes image
        │
        ▼
Club Manager: Reviews extracted fields side-by-side → Accepts selected fields
        │
        ▼
Club Manager: Submits Event for College Approval
        │
        ▼
College Admin: Reviews Event details & Advisory Duplicate warnings
        │
        ├── Rejects: Mandatory reason recorded → Notification sent to Club
        └── Approves: Event status = PUBLISHED → Live on Student Discovery feed
```

### Workflow B: Student Discovery, Registration & Attendance

```
Student: Searches Discovery Feed → Inspects Event Details
        │
        ▼
System: Checks registration window, capacity lock, and schedule conflicts
        │
        ▼
Student: Confirms Registration → Transactional row write + in-app notification
        │
        ▼
Event Day: Student opens Attendance QR Pass on mobile browser
        │
        ▼
Club Officer: Scans QR code using browser camera (or enters manual token)
        │
        ▼
Server: Validates HMAC credential, event match, timestamp, and college scope
        │
        ▼
Status updated to ATTENDED → Check-in timestamp recorded → Audit logged
        │
        ▼
Post-Event: Student submits rating & feedback (eligible within 30-day window)
```

---

## 10. Security measures

- **Argon2id Password Hashing:** Applied using tuned memory, iteration, and parallelism parameters.
- **Database-Backed Sessions:** Sessions are verified against PostgreSQL on every request; session tokens are stored in HttpOnly, Secure, SameSite cookies. Role changes immediately invalidate active sessions.
- **Hash-Only Reset Tokens:** Password recovery tokens are stored exclusively as SHA-256 hashes with single-use consumption and 30-minute expiry.
- **Per-User Rate Limiting:** Fixed-window rate limiters backed by PostgreSQL protect sensitive actions (OCR, uploads, exports, attendance check-ins, registrations, password resets). Keys use HMAC digests to prevent IP/email logging.
- **Content Security Policy (CSP):** Strict nonce-based CSP, frame-ancestors 'none', nosniff, and same-origin protections.
- **Anti-CSRF & Origin Verification:** Mandatory origin and referer header checking on all Server Actions and mutation endpoints.
- **Formula-Injection Safe Exports:** Every exported CSV string cell is sanitized against spreadsheet macro injection (`=`, `+`, `-`, `@`, tab, CR).
- **Tenant Isolation:** Composite foreign keys `(id, collegeId)` prevent cross-tenant record linking at the PostgreSQL engine level.

---

## 11. Database overview

The PostgreSQL database contains 27 models and 15 domain enums:

- **Tenancy:** `College` (root tenant), `User`, `StudentProfile`, `Club`, `ClubMembership`, `Category`.
- **Event Management:** `Event`, `EventPoster`, `EventCategory`, `EventRegistration`, `SavedEvent`.
- **Intelligence:** `EventDuplicateMatch`, `PosterOcrField`.
- **Operations:** `AttendanceCredential`, `EventFeedback`, `Notification`, `NotificationPreference`.
- **Security & Governance:** `Session`, `Account`, `Verification`, `PasswordResetToken`, `RateLimitEntry`, `AuditLog`, `AuthAuditEvent`.

Composite tenant indexes enforce cross-table integrity:

```prisma
@@unique([id, collegeId])
@@index([collegeId, status])
@@index([eventId, collegeId])
```

---

## 12. Local setup instructions

### Prerequisites

- Node.js `20.19` or `v24.x`
- Docker Desktop (for PostgreSQL 17)
- Git

### Installation Steps

1. **Clone repository & inspect:**

   ```powershell
   git status
   ```

2. **Start PostgreSQL container:**

   ```powershell
   docker start campuspulse-postgres
   # Or if creating fresh:
   docker run --name campuspulse-postgres -e POSTGRES_PASSWORD=postgres -p 5434:5432 -d postgres:17
   ```

3. **Install dependencies:**

   ```powershell
   npm ci
   ```

4. **Verify database connection:**

   ```powershell
   npm run db:health
   ```

5. **Generate Prisma Client:**

   ```powershell
   npm run db:generate
   ```

6. **Apply applied database migrations:**

   ```powershell
   npm run db:migrate:deploy
   ```

7. **Seed development fixtures (idempotent):**
   ```powershell
   npm run db:seed
   ```

---

## 13. Environment configuration

The application is configured via `.env.local`. All variables are validated at boot by `src/config/env.ts`:

```env
# Database Connections
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/campuspulse?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5434/campuspulse?schema=public"
TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5434/campuspulse_test?schema=public"

# Application URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Authentication Secrets
BETTER_AUTH_SECRET="campuspulse_super_secret_session_key_32_characters_minimum_length!"
BETTER_AUTH_URL="http://localhost:3000"
RATE_LIMIT_SECRET="campuspulse_rate_limit_secret_key_32_characters_minimum!"

# Storage Driver (local or s3)
POSTER_STORAGE_DRIVER="local"
POSTER_STORAGE_DIR=".data/posters"

# Email Configuration (Optional locally)
EMAIL_ENABLED="false"
EMAIL_FROM="CampusPulse <no-reply@campuspulse.local>"

# Proxy Security
TRUST_PROXY_HEADERS="false"
TRUSTED_PROXY_HOPS="1"
```

---

## 14. How to run the application

### Development Mode

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build & Run

```powershell
npm run build
npm run start
```

The application compiles into 42 static/dynamic routes and serves at [http://localhost:3000](http://localhost:3000).

### Verification Suite

```powershell
npx prisma validate
npm run db:generate
npm run typecheck
npm run lint
npm run format:check
git diff --check
npm test
```

### Health Check

```
GET http://localhost:3000/api/health
```

Returns HTTP 200 with database status, latency, and uptime.

---

## 15. Demo accounts

All demo accounts use the prepared local demo password:

```text
CampusPulse!2026
```

| Role              | Email                                    | Direct Route | Primary Verification Tasks                                         |
| :---------------- | :--------------------------------------- | :----------- | :----------------------------------------------------------------- |
| **Student**       | `isha.rao@campuspulse.example`           | `/student`   | Discover events, register, view QR pass, check calendar `.ics`.    |
| **Club Admin**    | `robotics.president@campuspulse.example` | `/club`      | Manage events, upload poster, test OCR review, check in attendees. |
| **College Admin** | `northfield.admin@campuspulse.example`   | `/college`   | Review pending approvals, advisory duplicates, moderate feedback.  |
| **Super Admin**   | `platform.admin@campuspulse.example`     | `/platform`  | Inspect college coverage, operational settings, platform audit.    |

---

## 16. Known limitations

1. **Local Demonstration Scope:** The application is verified on local infrastructure. Production hosting, custom domain DNS, and TLS certificates have not been provisioned.
2. **Storage Driver:** The local filesystem adapter is fully verified and demonstrated. The S3 adapter is implemented and unit-tested, but has not been connected to live AWS credentials.
3. **Outbound Email:** SMTP email delivery is disabled locally (`EMAIL_ENABLED=false`). Password reset links are logged to the console/test output for development demonstration.
4. **PostgreSQL RLS:** Row-Level Security at the database layer is not enabled; multi-tenancy is enforced through application services and composite foreign keys.
5. **Two-Way Calendar Sync:** Calendar integration provides authenticated one-way `.ics` export feeds; CalDAV/Google Calendar push sync is deferred to a future phase.
6. **Npm Audit Advisory:** Three high-severity advisories exist for `@prisma/client` transitive dependency `effect`; remediating them requires a major Prisma downgrade which was rejected to preserve framework stability.
7. **Demo Password Boundary:** Credentials in this document belong strictly to the local development environment and must never be used in a public or production deployment.
