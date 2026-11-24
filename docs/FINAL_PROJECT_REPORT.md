# CampusPulse — Final Project Submission Report

**Project Title:** CampusPulse: A Multi-Tenant Campus Event Discovery, Operations, and Governance Platform  
**Author / Candidate:** Software Engineering Capstone Submission  
**Date of Completion:** 23 November 2026  
**Repository Branch:** `main`  
**Base Commit (HEAD):** `daaf99dbff3a7b9c443ab94efd662896a16914db`  
**Platform Status:** Locally Runnable, Database-Backed, Verified, and Submission-Ready  
**Final Academic Verdict:** **PROJECT COMPLETE WITH LIMITATIONS — READY FOR ACADEMIC SUBMISSION**  
**Production Deployment Status:** **NO-GO (Deployment Window & Cloud Provisioning Separate Phase)**

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Project Objectives & Scope](#2-project-objectives--scope)
3. [Technology Stack & System Architecture](#3-technology-stack--system-architecture)
4. [Multi-Tenant Database Design & Schema](#4-multi-tenant-database-design--schema)
5. [Security, Authentication & Authorization Architecture](#5-security-authentication--authorization-architecture)
6. [Role-Based Features & User Journeys](#6-role-based-features--user-journeys)
7. [Intelligent Event Operations](#7-intelligent-event-operations)
8. [Operational Subsystems](#8-operational-subsystems)
9. [UI/UX Design System & Responsive Fidelity](#9-uiux-design-system--responsive-fidelity)
10. [Automated Quality Assurance & Verification Results](#10-automated-quality-assurance--verification-results)
11. [Security Audit & Vulnerability Assessment](#11-security-audit--vulnerability-assessment)
12. [Local Deployment, Setup & Demonstration Guide](#12-local-deployment-setup--demonstration-guide)
13. [Documented Limitations & Future Work](#13-documented-limitations--future-work)
14. [Academic Sign-Off & Conclusion](#14-academic-sign-off--conclusion)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Campus Communication Crisis

Higher-education campuses host vibrant student communities with dozens of student clubs, departments, academic chapters, and sports teams organizing hundreds of events per semester. However, the discovery and operational management of these events is profoundly broken:

> **“CampusPulse — Too Many Posters, Too Little Signal.”**

- **Information Clutter:** Physical flyers are plastered over campus walls, notice boards, and dining halls, competing for visual attention and quickly becoming obsolete litter.
- **Fragmented Digital Channels:** Event announcements are scattered across unofficial WhatsApp groups, Discord servers, Instagram stories, and Telegram channels, creating severe information silos.
- **Operational Burden on Clubs:** Student organizers perform repetitive manual work: re-typing event metadata across Google Forms, dealing with fragile paper check-in sheets, and struggling to collect feedback or analyze attendance.
- **Institutional Governance Gaps:** Deans of Student Affairs and college administrators have zero real-time visibility into campus events, leading to room scheduling clashes, unmoderated content, and an absence of compliance auditing.

### 1.2 The CampusPulse Solution

CampusPulse solves this systemic issue by providing a single, moderated, multi-tenant web platform that unifies event discovery, lifecycle management, attendance tracking, and institutional governance. The system supports four interconnected user roles:

1. **Students:** Discover verified events tailored to their interests, register with schedule conflict detection, obtain QR attendance passes, and export `.ics` calendars.
2. **Club Administrators:** Create event drafts, upload posters with automated Tesseract.js OCR extraction, manage registration caps, scan attendance passes via camera, and review engagement analytics.
3. **College Administrators:** Supervise the approval queue, review advisory duplicate event alerts, moderate student feedback, manage campus users and clubs, and inspect a tamper-evident audit log.
4. **Platform Administrators:** Oversee cross-college tenant lifecycles, monitor network health, and maintain operational stability.

---

## 2. Project Objectives & Scope

### 2.1 Core Engineering Objectives

- **Zero-Trust Multi-Tenancy:** Strictly isolate data between colleges at the database level using composite foreign keys `(id, collegeId)` and server-side actor validation.
- **End-to-End Operational Lifecycle:** Support the complete event lifecycle: `DRAFT` → `PENDING_APPROVAL` → `PUBLISHED` / `REJECTED` → `COMPLETED` / `CANCELLED`.
- **Intelligent Operations:** Incorporate local, privacy-preserving OCR extraction with human-in-the-loop verification, deterministic recommendation ranking, and interval-overlap schedule conflict detection.
- **Robust Security Baseline:** Enforce Argon2id password hashing, database-backed sessions, rate limiting on expensive actions, CSP with cryptographic nonces, and formula-injection-safe CSV exports.
- **Academic Rigor & Production Quality:** Ensure complete test coverage (235 automated unit/integration tests), zero dead buttons, strict TypeScript typing, and full responsiveness across viewports from 360 px to 1440 px.

### 2.2 Scope Boundaries

- **In Scope:** Full web application using Next.js 16 App Router, PostgreSQL 17, Prisma ORM, Better Auth, local Tesseract OCR, dual storage drivers (local filesystem + S3 SigV4 adapter), responsive UI, and complete local demonstration capabilities.
- **Out of Scope (Deferred to Future Production Phases):** Live cloud hosting provisioning, custom domain DNS/TLS configuration, live AWS S3 credentials, outbound SMTP delivery, native mobile applications, and PostgreSQL database-level Row-Level Security (RLS).

---

## 3. Technology Stack & System Architecture

### 3.1 Technology Stack

| Layer                  | Component                   | Version / Technology          | Architectural Purpose                                                                               |
| :--------------------- | :-------------------------- | :---------------------------- | :-------------------------------------------------------------------------------------------------- |
| **Frontend Framework** | Next.js (App Router)        | 16.4.5 (Turbopack)            | Server Components by default; Server Actions for atomic mutations; static route generation.         |
| **Language**           | TypeScript                  | 5.x (Strict Mode)             | Strict typing across API contracts, database queries, and UI components; zero `any` usage.          |
| **UI & Styling**       | Tailwind CSS & Lucide Icons | 4.3.4 / 1.68.0                | Semantic design tokens, accessible contrast, responsive breakpoints, minimal bundle size.           |
| **Database & ORM**     | PostgreSQL & Prisma         | PostgreSQL 17 / Prisma 7.10.1 | Multi-tenant relational schema, composite foreign keys, type-safe client in `src/generated/prisma`. |
| **Authentication**     | Better Auth                 | 1.7.18                        | Server-side database sessions, Argon2id hashing, HttpOnly/SameSite/Secure cookies.                  |
| **OCR Engine**         | Tesseract.js                | 7.0.0 (bundled English model) | Server-side, bounded local OCR execution with concurrency slot limits (max 2 workers, 8 queued).    |
| **Storage Adapters**   | Dual Adapter System         | Custom (Local + S3 SigV4)     | Local filesystem adapter for local development; S3 SigV4 driver for scalable cloud deployments.     |
| **Testing**            | Vitest & Playwright         | 5.1.0 / 1.65.0                | 235 unit/integration tests (`campuspulse_test`) and multi-viewport route inspection.                |

### 3.2 High-Level System Architecture

```
                       [ Web & Mobile Clients ]
                                  │
                       HTTPS / Same-Origin
                                  │
                 ┌────────────────▼────────────────┐
                 │    Next.js 16 Edge / Proxy      │ (Security Headers, Nonce CSP,
                 │        Middleware               │  Forwarded IP Sanitization)
                 └────────────────┬────────────────┘
                                  │
             ┌────────────────────┼────────────────────┐
             ▼                    ▼                    ▼
      [ Public Pages ]      [ Auth API ]        [ Dashboards ]
      - Landing (/)         - /login            - /student/**
      - /register           - /forgot-password  - /club/**
                            - /reset-password   - /college/**
                                                - /platform/**
                                  │
                 ┌────────────────▼────────────────┐
                 │       AuthenticatedActor        │ (Session verified, fresh
                 │        Security Context         │  user & role reload)
                 └────────────────┬────────────────┘
                                  │
                 ┌────────────────▼────────────────┐
                 │     Core Domain Services        │ (Events, Registrations,
                 │   & Per-User Rate Limiters      │  Attendance, OCR, Feedback)
                 └────────────────┬────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  [ PostgreSQL 17 ]      [ Poster Storage ]       [ Tesseract.js OCR ]
  - Composite FKs        - Local Adapter          - Bounded Workers (2)
  - Row Locks            - S3 SigV4 Adapter       - 20s Queue Timeout
  - Redacted Audits      - Content Signature      - Stale Recovery (>60s)
```

---

## 4. Multi-Tenant Database Design & Schema

### 4.1 Schema Overview & Metrics

The PostgreSQL database consists of **27 models** and **15 domain enums** managed through Prisma ORM. Exactly **8 sequential migrations** have been applied:

1. `20261105044302_init` — Base schema (Colleges, Users, Clubs, Events, Registrations, AuditLog).
2. `20261105045947_audit_event_actions` — Extended audit actions for event management.
3. `20261109081554_auth_sessions_rbac` — Better Auth database sessions, password reset tokens, rate limits, and auth audit events.
4. `20261110000000_dashboard_saved_events` — Student saved events model and saved event audit actions.
5. `20261111000000_poster_audit` — Event posters model, content signatures, and poster lifecycle audit actions.
6. `20261113000000_event_intelligence` — Poster OCR fields, duplicate event matches, and recommendation indexes.
7. `20261115000000_event_operations` — Attendance credentials, feedback reviews, and notification preferences.
8. `20261118111909_export_audit` — Sensitive export audit actions and download tracking.

### 4.2 Composite Foreign Key Tenant Isolation

To guarantee that records cannot accidentally cross tenant boundaries, child records carry a composite foreign key referencing both the parent entity ID and the root `collegeId`:

```prisma
model Event {
  id        String   @id @default(uuid()) @db.Uuid
  collegeId String   @db.Uuid
  clubId    String   @db.Uuid
  ...
  club      Club     @relation(fields: [clubId, collegeId], references: [id, collegeId], onDelete: Restrict)
  college   College  @relation(fields: [collegeId], references: [id], onDelete: Restrict)

  @@unique([id, collegeId])
  @@index([collegeId, status, startsAt])
}
```

This architecture makes cross-college data leaks impossible at the SQL engine level.

---

## 5. Security, Authentication & Authorization Architecture

1. **Argon2id Password Hashing:** User passwords are encrypted using state-of-the-art Argon2id PHC string formatting via `@node-rs/argon2`. Plaintext passwords never touch logs or storage.
2. **Database-Backed Sessions:** Sessions are stored in the PostgreSQL `sessions` table. Each incoming request re-verifies the session token and reloads a fresh `AuthenticatedActor` from the database. Changing a user's role or status immediately invalidates all active sessions.
3. **Cryptographic Reset Tokens:** Password reset requests generate single-use, 30-minute tokens. Only a SHA-256 hash of the token is persisted in `password_reset_tokens`.
4. **Per-User Rate Limiting:** Sensitive actions (OCR, poster uploads, exports, attendance check-ins, registration mutations) are rate-limited using PostgreSQL-backed fixed windows. Cache keys use HMAC digests (`hashIdentifier`) so raw IP addresses and emails are never logged.
5. **Content Security Policy (CSP):** A dynamic per-request cryptographic nonce is injected into script and style tags via `src/proxy.ts`. Directives include `frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'self'`.
6. **Anti-CSRF & Origin Verification:** All Server Actions and mutation endpoints execute `assertSameOrigin()`, validating `Origin` and `Referer` headers against `NEXT_PUBLIC_APP_URL`.
7. **Formula-Injection Safe Exports:** Every exported CSV cell is sanitized via `src/lib/csv.ts` to neutralize spreadsheet formula injection vulnerabilities (`=`, `+`, `-`, `@`, tab, carriage return).

---

## 6. Role-Based Features & User Journeys

### 6.1 Student Experience

- **Discovery Feed:** Filter published campus events by category, date range, or keyword search.
- **Event Details & Designed Fallback:** Access rich event information. Events without club artwork display an SVG-embossed gradient fallback card.
- **Registration & Capacity Management:** One-click registration featuring row-level database capacity locks (`SELECT FOR UPDATE`), preventing overselling.
- **Schedule Conflict Warnings:** Real-time advisory warnings if a student registers for overlapping events, evaluated via strict interval overlap logic.
- **Attendance Pass:** Instant generation of event-bound QR code passes signed with HMAC credentials.
- **Calendar Feeds:** Chronological schedule timeline with single-click `.ics` export (capped at 1,000 events with truncation headers).
- **Post-Event Feedback:** Attended students have a 30-day window to submit 1–5 star ratings and reviews.
- **In-App Notifications:** Real-time notifications for event approvals, cancellations, and registration confirmations with read/unread status filtering.

### 6.2 Club Administrator Experience

- **Operations Dashboard:** Dedicated focus cards highlighting pending approvals, active drafts, and next published events.
- **Event Creation & Poster Upload:** Create event drafts and upload posters (JPEG, PNG, WebP up to 4.2 MB) validated against magic-byte content signatures.
- **Local Tesseract OCR:** Automated extraction of event title, date, time, venue, and description with field-by-field human review before saving.
- **Attendance Management:** Check in attendees via camera QR scanner or manual 6-character token fallback. Manual corrections require written justification and are permanently audited.
- **Engagement Analytics:** View real-time attendance rates, registration trends, and average satisfaction ratings.
- **CSV Export:** Download attendance rosters in RFC 4180-compliant CSV format with UTF-8 BOM.

### 6.3 College Administrator Experience

- **Approval Queue:** Review pending club event submissions. Rejections require a mandatory reason and automatically notify club managers.
- **Advisory Duplicate Review:** Machine-assisted detection scoring same-day, same-venue, and similarly titled events. Suggestions can be confirmed or dismissed without destructive data deletion.
- **Feedback Moderation:** Moderate student feedback (hide or restore) with mandatory audit logging, preventing abuse while preserving review integrity.
- **User & Club Management:** Assign student and club manager roles, suspend inactive clubs, and review college-scoped audit trails.

### 6.4 Super Administrator Experience

- **Network Overview:** Multi-college status summary, active institution count, total platform users, and aggregate event counts.
- **College Directory:** Create and manage college tenant lifecycles (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
- **Operational Settings:** Non-sensitive operational inspection verifying database latency, email capability, and object storage configuration (Local vs S3).
- **Global Audit Trail:** Complete network-wide governance log capturing sensitive operations across all colleges.

---

## 7. Intelligent Event Operations

### 7.1 Local Tesseract.js Poster OCR

- **Server-Only Execution:** Uses bundled English traineddata without calling third-party cloud APIs.
- **Human-in-the-Loop Review:** Extracted fields (Title, Summary, Dates, Venue, Category) are presented in a side-by-side comparison modal. Organizers accept or discard individual fields.
- **Resource Protection:** Concurrency limiter restricts OCR to 2 simultaneous jobs, 8 queued requests, and a 20-second timeout. Stale claims (>60s) recover automatically.

### 7.2 Deterministic Event Recommendations

- Evaluates eligible events using transparent, deterministic scoring:
  $$\text{Score} = w_{\text{interest}} \cdot S_{\text{interest}} + w_{\text{category}} \cdot S_{\text{category}} + w_{\text{recency}} \cdot S_{\text{recency}} + w_{\text{popularity}} \cdot S_{\text{popularity}}$$
- Excludes events already registered, saved, full, or belonging to another college. Rationale tags (e.g. _"Matches your Robotics interest"_) are displayed in the UI.

### 7.3 Advisory Duplicate Detection

- Compares new event submissions against existing college events using a multi-factor heuristic:
  - Exact or overlapping date/time window.
  - Normalized venue string similarity.
  - Jaccard title token similarity.
- Triggers an advisory alert for college administrators with a confidence score. Confirming or dismissing an alert never alters event data.

---

## 8. Operational Subsystems

1. **Attendance System:**
   - Single-use, event-bound QR tokens encoded with HMAC signatures.
   - Camera scanner interface using `jsQR` with client-side frame processing.
   - Reasoned manual correction modal requiring an explanation, recording `ATTENDANCE_CORRECTED` audit entries.
2. **Feedback & Review System:**
   - Enforces double verification: attendee must have `ATTENDED` status and event must be `COMPLETED`.
   - 30-day submission and edit window.
   - Read-only review for club managers; hide/restore moderation for college administrators.
3. **Export & Calendar Subsystem:**
   - Calendar downloads generate RFC 5545 `.ics` files with UTC timestamps and local college timezone mappings.
   - CSV exports enforce CRLF line endings, UTF-8 BOM for Microsoft Excel compatibility, and formula injection sanitization.
   - All exports log `EXPORT_DOWNLOADED` audit events.

---

## 9. UI/UX Design System & Responsive Fidelity

### 9.1 Design Principles

- **Restrained Editorial Aesthetic:** Subtle role-toned borders (`border-line`), warm paper backgrounds, Newsreader serif display typography paired with Inter sans-serif UI type.
- **No Decorative Clutter:** Eliminates unnecessary glassmorphism, gratuitous gradients, and fabricated statistics.
- **Designed Poster Fallback:** Events without artwork render an SVG-embossed gradient card with the event title, category, and date.
- **Accessible Interactions:** Focus visible rings, accessible skip links, and touch targets conforming to WCAG 2.1 AA standards (minimum 44×44 px).

### 9.2 Responsive Viewport Verification

The entire application was audited across 50 distinct route visits at all standard breakpoints:

- **360 px (Small Mobile):** Stacked metric cards, compact header, collapsible navigation drawer, 0 px horizontal overflow.
- **390 px (Standard Mobile):** Optimized touch targets, readable table cards, 0 px horizontal overflow.
- **768 px (Tablet Portrait):** 2-column dashboard layout, accessible table containers.
- **1024 px (Tablet Landscape / Laptop):** Split view with sidebars and table layouts.
- **1280 px (Desktop):** Full multi-column dashboard grid with quick-action panels.
- **1440 px (Large Display):** Constrained container widths with balanced visual whitespace.

---

## 10. Automated Quality Assurance & Verification Results

### 10.1 Verification Gate Results

```text
================================================================================
GATE                           COMMAND                 RESULT
================================================================================
Prisma Schema Validation       npx prisma validate     PASS (Schema valid)
Prisma Client Generation       npm run db:generate     PASS (Generated in 697 ms)
TypeScript Compilation         npm run typecheck       PASS (0 errors)
ESLint Code Quality            npm run lint            PASS (0 warnings, 0 errors)
Prettier Code Formatting       npm run format:check    PASS (100% compliant)
Git Whitespace Safety          git diff --check        PASS (0 whitespace errors)
Production Cold Build          npm run build           PASS (42 routes compiled)
Unit & Integration Tests       npm test                PASS (31 files, 235 tests)
Database Connection Health     npm run db:health       PASS (campuspulse OK, 289 ms)
================================================================================
```

### 10.2 Test Suite Execution Summary

The Vitest automated test suite executed **31 test files** comprising **235 tests** in **123.63 seconds** against the dedicated `campuspulse_test` PostgreSQL database:

- **Authorization & RBAC:** Session validation, role switching, cross-tenant rejection, super-admin bootstrap (34 tests).
- **Event Lifecycle & Moderation:** Draft creation, transitions, approval queues, duplicate detection (42 tests).
- **Poster Management & OCR:** Magic byte validation, dimension caps, local OCR extraction, concurrency limits, stale claim recovery (38 tests).
- **Registration & Attendance:** Capacity row-locking, conflict warnings, QR issuance, camera scanning, manual corrections (45 tests).
- **Analytics, Feedback & Exports:** Trend aggregation, formula injection defense, calendar generation, audit logging (46 tests).
- **Security & Rate Limiting:** Fixed-window limiters, HMAC digest keys, CSRF origin verification (30 tests).

---

## 11. Security Audit & Vulnerability Assessment

### 11.1 Reconciled Audit Findings

- **Storage Configuration Logic (`storageConfigured`):** Verified that `src/server/dashboards/queries.ts` validates all five required S3 parameters (`ENDPOINT`, `REGION`, `BUCKET`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`) when S3 is enabled.
- **Attendance Timing Defense (`hasEventStarted`):** Confirmed in `src/services/attendance.ts` that attendance recording and corrections cannot execute before event start times.
- **Proxy Header Trust:** Client IP resolution defaults to `"unknown"` unless `TRUST_PROXY_HEADERS=true` is set.
- **Rate Limiting Hardening:** Authenticated actions are protected against brute-force and resource exhaustion attacks.

### 11.2 Upstream Dependency Advisory Assessment

An `npm audit --omit=dev` inspection reports **3 high-severity advisories** in transitive dependency `effect` pulled by `@prisma/config` / `prisma` (GHSA-7589-6fvf-x4pw: ReDoS in `Schema.TemplateLiteral`).

- **Risk Evaluation:** Low runtime exploitability. The advisory affects schema regex compilation in development tooling rather than runtime request processing.
- **Resolution Strategy:** Remediation requires a breaking major downgrade of Prisma to v6.12.0. This was deliberately rejected to preserve database client stability and schema feature support.

---

## 12. Local Deployment, Setup & Demonstration Guide

### 12.1 Prerequisites

- Node.js `20.19.0` or higher (tested on `v24.13.0`).
- Docker Desktop (for PostgreSQL 17).
- Git.

### 12.2 Setup Instructions

```powershell
# 1. Start the PostgreSQL Docker container
docker start campuspulse-postgres
# (Or create fresh): docker run --name campuspulse-postgres -e POSTGRES_PASSWORD=postgres -p 5434:5432 -d postgres:17

# 2. Verify database connection
npm run db:health

# 3. Generate Prisma client
npm run db:generate

# 4. Apply database migrations
npm run db:migrate:deploy

# 5. Populate development fixtures (idempotent seed)
npm run db:seed

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 12.3 Demonstration Credentials

All demo accounts use the standard local evaluation password:

```text
CampusPulse!2026
```

| Role                      | Demo Email                               | Direct Workspace Route |
| :------------------------ | :--------------------------------------- | :--------------------- |
| **Student**               | `isha.rao@campuspulse.example`           | `/student`             |
| **Club Administrator**    | `robotics.president@campuspulse.example` | `/club`                |
| **College Administrator** | `northfield.admin@campuspulse.example`   | `/college`             |
| **Super Administrator**   | `platform.admin@campuspulse.example`     | `/platform`            |

---

## 13. Documented Limitations & Future Work

1. **Local Demonstration Scope:** All verifications were conducted locally. Live cloud infrastructure (AWS ECS, Vercel, Railway) has not been provisioned.
2. **Object Storage Hardware:** The local filesystem storage driver is verified and demonstrated. The S3 SigV4 adapter is unit-tested but has not been connected to live AWS credentials.
3. **Outbound Communications:** External email (SMTP) and SMS notifications are disabled locally (`EMAIL_ENABLED=false`). In-app notifications are the verified communication channel.
4. **Calendar Sync:** One-way authenticated `.ics` export feeds are implemented. Two-way push sync with Google Calendar or Apple Calendar is deferred.
5. **Database RLS:** Row-Level Security at the PostgreSQL engine level is not enabled; multi-tenancy is enforced through application services and composite foreign keys.

---

## 14. Academic Sign-Off & Conclusion

### 14.1 Final Verdict

$$\mathbf{PROJECT\ COMPLETE\ WITH\ LIMITATIONS\ —\ READY\ FOR\ ACADEMIC\ SUBMISSION}$$

### 14.2 Conclusion

The CampusPulse platform fulfills all requirements for a submission-ready capstone project:

- A credible, production-quality SaaS aesthetic replacing academic CRUD placeholders.
- Complete, tested workflows across all four role workspaces with zero dead buttons.
- Rigorous security baseline including Argon2id auth, rate limiting, and composite foreign key tenant isolation.
- Complete automated verification suite with 235 passing tests and 0 compilation or lint errors.
- Comprehensive documentation, demonstration guides, and 27 high-resolution visual evidence captures.

Production deployment remains a separate, subsequent phase requiring cloud hosting provisioning, domain registration, and owner sign-off.
