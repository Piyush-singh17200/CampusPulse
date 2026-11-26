# CampusPulse — Complete Product & Repository Audit

**Date:** 2026-11-24  
**Repository:** `C:\Users\singh\OneDrive\Desktop\CAMPUSPULSE`  
**Git Branch:** `main`  
**Classification Schema:**

1. `IMPLEMENTED AND VERIFIED`
2. `IMPLEMENTED BUT INCOMPLETE`
3. `BACKEND EXISTS, FRONTEND MISSING`
4. `FRONTEND EXISTS, BACKEND MISSING`
5. `COMPLETELY MISSING`
6. `BROKEN OR INACCESSIBLE`
7. `SECURITY ISSUE`
8. `NOT APPLICABLE`

---

## 1. Architecture & Core Infrastructure

| Component / Subsystem                   | Source Location                             | Classification               | Findings & Operational Analysis                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-Tenant Database Engine**        | `prisma/schema.prisma`, `src/server/db/`    | **IMPLEMENTED AND VERIFIED** | PostgreSQL 17 via Neon. 28 Prisma models. Composite keys (`[id, collegeId]`) enforce tenant isolation at database engine level.                                                           |
| **Prisma PgAdapter & TLS Pooling**      | `src/server/db/factory.ts`                  | **IMPLEMENTED AND VERIFIED** | `@prisma/adapter-pg` configured with connection pool limits, SSL `rejectUnauthorized: true`, statement timeouts, and clean error masking.                                                 |
| **Transaction Boundaries**              | `src/server/db/transactions.ts`             | **IMPLEMENTED AND VERIFIED** | Server-side `runInTransaction` wrapper prevents orphaned records across multi-table writes.                                                                                               |
| **Authentication Engine**               | `src/server/auth/auth.ts`                   | **IMPLEMENTED AND VERIFIED** | Better Auth with PostgreSQL adapter. Public sign-up endpoint disabled (`disableSignUp: true`). Server action registration only.                                                           |
| **Password Security**                   | `src/server/auth/password.ts`               | **IMPLEMENTED AND VERIFIED** | Argon2id PHC hashing with 64MB memory cost, 3 iterations, and constant-time dummy hash verification (`burnPasswordHash`) on unknown user logins.                                          |
| **Session Architecture**                | `src/server/auth/session.ts`                | **IMPLEMENTED AND VERIFIED** | Database-backed sessions in `sessions` table. Session cookies: `HttpOnly`, `SameSite: Lax`, `Secure` in production. Every request validates fresh actor role & status against PostgreSQL. |
| **Rate Limiting**                       | `src/server/auth/rate-limit.ts`             | **IMPLEMENTED AND VERIFIED** | PostgreSQL-backed atomic token bucket (`rate_limit_entries` table). HMAC-SHA256 hashed identifiers for IP and email keys.                                                                 |
| **Audit Logging**                       | `src/server/auth/audit.ts`, `src/services/` | **IMPLEMENTED AND VERIFIED** | Dual-layer audit logging: `auth_audit_events` for authentication/session security and `audit_logs` for domain operations. Masked IPs and zero secret storage.                             |
| **S3 Object Storage**                   | `src/services/poster-storage.ts`            | **IMPLEMENTED AND VERIFIED** | AWS SDK v3 S3 client supporting Supabase S3-compatible private buckets (`campuspulse-posters`) with fallback to local filesystem driver.                                                  |
| **Optical Character Recognition (OCR)** | `src/services/poster-ocr.ts`                | **IMPLEMENTED AND VERIFIED** | Node Tesseract engine (`tesseract.js`) with 120-second timeout, state-machine claim recovery, retry cooldowns, and structured text field extraction.                                      |

---

## 2. Four-Role System Audit

### A. Student Experience (`STUDENT`)

| Feature                           | Routes / Components                                                                 | Classification                 | Status & Observations                                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Student Overview**              | `/student`, `src/app/student/page.tsx`                                              | **IMPLEMENTED AND VERIFIED**   | Displays live upcoming events, active college announcements, saved events preview, registered events quick list, and category filters.                                      |
| **Event Discovery & Search**      | `/student/discover`, `src/app/student/discover/page.tsx`                            | **IMPLEMENTED AND VERIFIED**   | Full search by keyword, category, date range, format (online/in-person), and recommendation signals. Excludes other-college events.                                         |
| **Event Details & Poster**        | `/student/events/[eventId]`                                                         | **IMPLEMENTED AND VERIFIED**   | Shows full description, dates in college timezone, venue/online details, organizer club, category badges, and secure poster image view.                                     |
| **Event Registration**            | `/student/events/[eventId]`, `registerForEventAction`                               | **IMPLEMENTED AND VERIFIED**   | Validates registration window, capacity cap (prevents overselling under race conditions), active student profile, and tenant boundary.                                      |
| **Registration Cancellation**     | `/student/registrations`, `cancelRegistrationAction`                                | **IMPLEMENTED AND VERIFIED**   | Allows student to cancel confirmed registrations prior to event end; frees capacity and audits cancellation.                                                                |
| **Saved Events**                  | `/student/saved`, `saveEventAction`, `unsaveEventAction`                            | **IMPLEMENTED AND VERIFIED**   | Bookmark events with one click; persists in `saved_events` table; idempotent actions.                                                                                       |
| **My Registrations**              | `/student/registrations`                                                            | **IMPLEMENTED AND VERIFIED**   | Lists all confirmed, attended, and cancelled registrations with links to attendance QR credentials.                                                                         |
| **Calendar Schedule View**        | `/student/calendar`                                                                 | **IMPLEMENTED AND VERIFIED**   | Monthly and agenda views of registered and saved events with status indicators.                                                                                             |
| **Schedule Conflict Detection**   | `src/services/schedule-conflicts.ts`                                                | **IMPLEMENTED AND VERIFIED**   | Analyzes overlapping event time windows during registration and alerts students before confirmation.                                                                        |
| **Event Notifications**           | `/student/notifications`                                                            | **IMPLEMENTED AND VERIFIED**   | In-app notification center for registration confirmation, event updates, cancellations, and check-in reminders. Single-read and mark-all-read.                              |
| **Notification Preferences**      | `/student/notifications`, `NotificationPreferenceForm`                              | **IMPLEMENTED AND VERIFIED**   | Persists toggles for registration updates, attendance alerts, and feedback reminders in `notification_preferences` table.                                                   |
| **Personal Attendance QR**        | `/student/registrations/[registrationId]/attendance`                                | **IMPLEMENTED AND VERIFIED**   | Generates rotating HMAC-SHA256 attendance QR code valid only within the event's check-in window (2 hours before start to 2 hours after end). Displays manual code fallback. |
| **Feedback Submission & History** | `/student/feedback`, `FeedbackForm`                                                 | **IMPLEMENTED AND VERIFIED**   | Allows verified attendees to submit 1–5 star ratings and comments within 30 days of event completion. Allows editing prior feedback.                                        |
| **ICS Calendar Export**           | `/api/calendar/events/[eventId]`, `/api/calendar/registered`, `/api/calendar/saved` | **IMPLEMENTED AND VERIFIED**   | RFC 5545 compliant `.ics` calendar files with injection-safe escaping, download headers, and session verification.                                                          |
| **Student Profile Management**    | `/student/profile`, `StudentProfileForm`                                            | **IMPLEMENTED AND VERIFIED**   | Editable name, roll number, department, graduation year, bio, and campus interests. College and role remain server-locked.                                                  |
| **Student Settings Access**       | `src/app/student/layout.tsx`                                                        | **IMPLEMENTED BUT INCOMPLETE** | Student sidebar navigation has `Profile` but lacks a dedicated `Settings` navigation item linking to `/account`.                                                            |

---

### B. Club Administrator Experience (`CLUB_ADMIN`)

| Feature                           | Routes / Components                                            | Classification                       | Status & Observations                                                                                                                                  |
| --------------------------------- | -------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Club Overview**                 | `/club`, `src/app/club/page.tsx`                               | **IMPLEMENTED AND VERIFIED**         | Overview metrics (total events, registrations, attendance rate, feedback score), active switcher for managers with multiple clubs.                     |
| **Create Event**                  | `/club/events/create`, `createEventAction`                     | **IMPLEMENTED AND VERIFIED**         | Full event form with title, summary, description, start/end datetimes, format, venue name/address, capacity, categories, interests, and poster upload. |
| **Edit Event**                    | `/club/events/[eventId]/edit`, `updateEventAction`             | **IMPLEMENTED AND VERIFIED**         | Allows editing draft, rejected, and published events. Prevents changing college or club ownership.                                                     |
| **Cancel Event**                  | `/club/events/[eventId]`, `transitionEventAction`              | **IMPLEMENTED AND VERIFIED**         | Requires cancellation reason; cancels student registrations and sends in-app notifications.                                                            |
| **Event Lifecycle Transitions**   | `src/services/events.ts`                                       | **IMPLEMENTED AND VERIFIED**         | Supports `DRAFT` → `PENDING_APPROVAL` → `PUBLISHED` → `COMPLETED` / `CANCELLED` and `REJECTED` → `DRAFT`. Invalid transitions fail closed.             |
| **Poster Upload & Management**    | `PosterField`, `uploadPosterAction`, `removePosterAction`      | **IMPLEMENTED AND VERIFIED**         | Multipart file upload with magic byte sniffing (JPEG, PNG, WebP), 5MB size limit, SHA-256 deduplication, and S3 upload.                                |
| **Poster OCR Text Extraction**    | `PosterOcrPanel`, `runPosterOcrAction`, `applyPosterOcrAction` | **IMPLEMENTED AND VERIFIED**         | Executes background OCR on poster image; previews extracted fields (title, date, time, venue); allows selective field adoption.                        |
| **Registration Roster**           | `/club/registrations`                                          | **IMPLEMENTED AND VERIFIED**         | Server-paginated and searchable list of registered students with roll number, department, status, and check-in time.                                   |
| **QR Attendance Scanner**         | `/club/attendance`, `QrScanner`                                | **IMPLEMENTED AND VERIFIED**         | HTML5 camera scanner with `jsqr` decoding, permission error handling, live video preview, and manual code submission form.                             |
| **Attendance Window Enforcement** | `src/services/attendance.ts`                                   | **IMPLEMENTED AND VERIFIED**         | Strict window check: check-in opens 2 hours before event starts and closes 2 hours after event ends. Prevents early/late scans.                        |
| **Duplicate Scan Prevention**     | `src/services/attendance.ts`                                   | **IMPLEMENTED AND VERIFIED**         | Atomic `usedAt` check in PostgreSQL transaction. Repeated scans reject with 409 Conflict.                                                              |
| **Manual Attendance Correction**  | `/club/attendance`, `AttendanceCorrectionForm`                 | **IMPLEMENTED AND VERIFIED**         | Allows club manager to correct status (`ATTENDED`, `NO_SHOW`, `CONFIRMED`) with mandatory reason stored in audit log.                                  |
| **CSV Attendance Export**         | `/api/exports/club/attendance`                                 | **IMPLEMENTED AND VERIFIED**         | Downloads CSV roster with sanitized cells (prevents CSV formula injection). Role and tenant scoped.                                                    |
| **Club Analytics**                | `/club/analytics`, `src/app/club/analytics/page.tsx`           | **IMPLEMENTED AND VERIFIED**         | Computes attendance rates, registration trends, feedback averages, and per-event metrics from real PostgreSQL rows.                                    |
| **Club Feedback Review**          | `/club/feedback`                                               | **IMPLEMENTED AND VERIFIED**         | Displays verified student feedback scores and comments for managed club events.                                                                        |
| **Club Public Profile Settings**  | `/club/settings`, `ClubSettingsForm`                           | **IMPLEMENTED AND VERIFIED**         | Editable club description, contact email, social links. Status, college ownership, and slug are server-protected.                                      |
| **Club Membership Management**    | `/club/settings`                                               | **BACKEND EXISTS, FRONTEND MISSING** | `ClubMembership` model and service exist; College Admin assigns managers; inline club member invitation UI within club dashboard is missing.           |

---

### C. College Administrator Experience (`COLLEGE_ADMIN`)

| Feature                                 | Routes / Components                                    | Classification               | Status & Observations                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **College Overview**                    | `/college`, `src/app/college/page.tsx`                 | **IMPLEMENTED AND VERIFIED** | College KPI metrics (active clubs, upcoming events, pending approvals, total students, 30-day attendance rate).                                               |
| **Event Approvals Queue**               | `/college/approvals`, `transitionEventAction`          | **IMPLEMENTED AND VERIFIED** | Review queue for events in `PENDING_APPROVAL`. College admins can one-click approve (`PUBLISHED`) or reject (`REJECTED`) with required reason.                |
| **All College Events**                  | `/college/events`, `/college/events/[eventId]`         | **IMPLEMENTED AND VERIFIED** | Master list of all events in the college across all clubs, filterable by status. Detail page allows cancellation, completion, and duplicate review.           |
| **Duplicate Event Review**              | `DuplicateReviewCard`, `reviewDuplicateAction`         | **IMPLEMENTED AND VERIFIED** | Triggers duplicate detection algorithm (same day, same venue, title similarity >= 0.70); provides confirm/dismiss advisory review.                            |
| **Club Management**                     | `/college/clubs`, `/college/clubs/[clubId]`            | **IMPLEMENTED AND VERIFIED** | View all clubs, create club, approve/reject/suspend clubs (`decideClubAction`), view club audit history.                                                      |
| **Club Administrator Assignment**       | `/college/clubs/[clubId]`, `changeUserRoleAction`      | **IMPLEMENTED AND VERIFIED** | Appoint or revoke club managers (`PRESIDENT`, `OFFICER`). Updates `club_memberships` and synchronizes user role to `CLUB_ADMIN`.                              |
| **User Directory & Moderation**         | `/college/users`, `src/app/college/users/page.tsx`     | **IMPLEMENTED AND VERIFIED** | Search and filter college users by role and status. Change role (`STUDENT`, `CLUB_ADMIN`). Suspend, activate, or disable accounts (`changeUserStatusAction`). |
| **Session Revocation on User Change**   | `src/services/user-status.ts`                          | **IMPLEMENTED AND VERIFIED** | Modifying user role or status immediately invalidates all active sessions in the `sessions` table, forcing re-authentication.                                 |
| **Feedback Moderation**                 | `/college/feedback`, `FeedbackModerationForm`          | **IMPLEMENTED AND VERIFIED** | Moderate student feedback comments (`VISIBLE`, `HIDDEN`, `FLAGGED`) with audit trail.                                                                         |
| **College Analytics & Reporting**       | `/college/analytics`, `/api/exports/college/analytics` | **IMPLEMENTED AND VERIFIED** | College-wide metrics across clubs, attendance trends, category distributions, and downloadable CSV exports.                                                   |
| **College Audit Logs**                  | `/college/audit-logs`                                  | **IMPLEMENTED AND VERIFIED** | Filterable log viewer for all administrative and moderation events within the tenant.                                                                         |
| **College Settings**                    | `/college/settings`, `CollegeSettingsForm`             | **IMPLEMENTED AND VERIFIED** | Configure college display name, short name, timezone. Primary domain and slug are read-only.                                                                  |
| **QR Scanner Access for College Admin** | `/club/attendance`                                     | **BROKEN OR INACCESSIBLE**   | `requireDashboardRole("CLUB_ADMIN")` blocks `COLLEGE_ADMIN`, even though `assertCanManageEventAttendance` backend authorizes college admins.                  |

---

### D. Super Administrator Experience (`SUPER_ADMIN`)

| Feature                               | Routes / Components                                      | Classification                       | Status & Observations                                                                                                                                    |
| ------------------------------------- | -------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platform Overview**                 | `/platform`, `src/app/platform/page.tsx`                 | **IMPLEMENTED AND VERIFIED**         | Cross-tenant counts (total colleges, users, clubs, events, 30-day activity), newest colleges list, system operational signals.                           |
| **College Directory**                 | `/platform/colleges`                                     | **IMPLEMENTED AND VERIFIED**         | Search and filter all colleges across the network by status (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).                                                         |
| **College Detail & Tenant Lifecycle** | `/platform/colleges/[collegeId]`                         | **IMPLEMENTED AND VERIFIED**         | College statistics, administrators list, status transition controls (`ACTIVE` ↔ `SUSPENDED` ↔ `ARCHIVED`).                                               |
| **College Suspension Enforcement**    | `src/services/colleges.ts`                               | **IMPLEMENTED AND VERIFIED**         | Suspending a college immediately revokes all sessions belonging to any user in that tenant and prevents actor authentication.                            |
| **Cross-Tenant User Directory**       | `/platform/users`                                        | **IMPLEMENTED AND VERIFIED**         | Global user search across all colleges. Filter by college, role, status. Change status (`ACTIVE`, `SUSPENDED`, `DISABLED`). Self-modification prevented. |
| **Platform Governance & Audit Logs**  | `/platform/audit-logs`                                   | **IMPLEMENTED AND VERIFIED**         | Complete cross-tenant audit trail with college filter, action filter, and timestamp ordering. Zero credentials exposed.                                  |
| **Platform Analytics & Reporting**    | `/platform/analytics`, `/api/exports/platform/analytics` | **IMPLEMENTED AND VERIFIED**         | Global platform analytics across all colleges, clubs, and events with secure CSV download.                                                               |
| **Platform Settings & Status**        | `/platform/settings`                                     | **IMPLEMENTED AND VERIFIED**         | System health status for Database, Object Storage (S3/local), and Email delivery. Explains security boundary.                                            |
| **Web UI for Creating New Colleges**  | `/platform/colleges`                                     | **BACKEND EXISTS, FRONTEND MISSING** | `bootstrap-college.ts` CLI script exists and works; however, the web UI lacks an inline "Create College" modal or form.                                  |
| **QR Scanner Access for Super Admin** | `/club/attendance`                                       | **BROKEN OR INACCESSIBLE**           | `requireDashboardRole("CLUB_ADMIN")` blocks `SUPER_ADMIN`, even though backend service `assertCanManageEventAttendance` authorizes platform admins.      |

---

## 3. Settings Center Audit (Phase 3)

| Settings Domain                     | Current Location               | Classification                       | Detailed Findings                                                                                                                                                       |
| ----------------------------------- | ------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Personal Profile Information**    | `/account`, `/student/profile` | **IMPLEMENTED BUT INCOMPLETE**       | Account information displayed on `/account` is read-only. Student profile editing exists on `/student/profile`. Admins have no personal name update form.               |
| **Password Management (Logged In)** | `/account`                     | **BACKEND EXISTS, FRONTEND MISSING** | Argon2id verification and hashing functions exist; `/forgot-password` flow works; but there is no inline "Change Password" form on `/account`.                          |
| **Active Sessions Management**      | `/account`                     | **BACKEND EXISTS, FRONTEND MISSING** | `Session` model records active sessions with IP and user agent; `revokeAllSessionsForUser` exists; but `/account` does not list active sessions or allow revoking them. |
| **Notification Preferences**        | `/student/notifications`       | **IMPLEMENTED BUT INCOMPLETE**       | Implemented on student notifications page via `NotificationPreferenceForm`. Not accessible from a central settings screen.                                              |
| **Theme / Appearance Settings**     | Global                         | **COMPLETELY MISSING**               | No UI toggle for Light / Dark / System mode. CSS has only light theme tokens in `:root`.                                                                                |
| **Privacy & Data Security**         | `/account`                     | **IMPLEMENTED BUT INCOMPLETE**       | Session expiration and HttpOnly cookie security are described; CSV exports exist; account deactivation request is missing.                                              |
| **College Settings**                | `/college/settings`            | **IMPLEMENTED AND VERIFIED**         | Accessible to `COLLEGE_ADMIN` and `SUPER_ADMIN`. Configures college name, short name, timezone.                                                                         |
| **Club Settings**                   | `/club/settings`               | **IMPLEMENTED AND VERIFIED**         | Accessible to active `CLUB_ADMIN` managers. Configures public profile, email, description.                                                                              |
| **Platform Settings**               | `/platform/settings`           | **IMPLEMENTED AND VERIFIED**         | Accessible to `SUPER_ADMIN`. Displays operational health, storage drivers, network counts.                                                                              |
| **Sidebar Navigation to Settings**  | Dashboard layouts              | **IMPLEMENTED BUT INCOMPLETE**       | Student sidebar lacks a `Settings` link. Dashboard footers display user info but clicking does not navigate to `/account`.                                              |

---

## 4. Event Lifecycle & Media Audit (Phases 4 & 5)

| Workflow Step                  | Implementation File                                                 | Status       | Notes                                                                        |
| ------------------------------ | ------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| 1. Creation & Input Validation | `src/features/dashboards/components/event-form.tsx`                 | **VERIFIED** | Zod schema validation; start/end constraints.                                |
| 2. Poster Upload & Magic Bytes | `src/services/poster-validation.ts`                                 | **VERIFIED** | Validates PNG, JPEG, WebP magic bytes and 5MB size limit.                    |
| 3. S3 / Supabase Storage       | `src/services/poster-storage.ts`                                    | **VERIFIED** | Private bucket storage; authenticated proxy route `/api/posters/[posterId]`. |
| 4. OCR Processing & Review     | `src/services/poster-ocr.ts`, `PosterOcrPanel`                      | **VERIFIED** | Real-time extraction with cooldown and timeout abort controls.               |
| 5. Duplicate Detection         | `src/services/duplicate-events.ts`                                  | **VERIFIED** | Automatic scan on submission; advisory review cards for college admins.      |
| 6. Schedule Conflict Warning   | `src/services/schedule-conflicts.ts`                                | **VERIFIED** | Real-time overlap detection against registered student calendar.             |
| 7. Approval & Moderation       | `src/app/college/approvals/page.tsx`                                | **VERIFIED** | One-click approval / rejection with recorded audit reasons.                  |
| 8. Publishing & Discovery      | `src/app/student/discover/page.tsx`                                 | **VERIFIED** | Searchable by title, club, category, date, format.                           |
| 9. Registration & Capacity     | `src/services/registrations.ts`                                     | **VERIFIED** | Prevents overselling; concurrency-safe transactions.                         |
| 10. QR Credential Issuance     | `src/services/attendance.ts`                                        | **VERIFIED** | Rotating HMAC-SHA256 tokens within 2-hour check-in window.                   |
| 11. QR Scan & Check-in         | `src/features/dashboards/components/qr-scanner.tsx`                 | **VERIFIED** | Working HTML5 camera + `jsqr` decode with manual code fallback.              |
| 12. Manual Correction & Audit  | `src/features/dashboards/components/attendance-correction-form.tsx` | **VERIFIED** | Mandatory audit reasons for any status override.                             |
| 13. Feedback & Rating          | `src/features/dashboards/components/feedback-form.tsx`              | **VERIFIED** | Verified attendees only; 30-day window; moderation support.                  |
| 14. Analytics & CSV Export     | `src/server/dashboards/engagement-analytics.ts`                     | **VERIFIED** | Real database queries; injection-safe CSV formula protection.                |

---

## 5. Security & Isolation Audit (Phase 6)

| Security Domain                | Mechanism                                                   | Verification Result                                                                        |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **Tenant Isolation**           | Foreign key constraints on `[id, collegeId]` in PostgreSQL  | **PASS** — Cross-tenant queries fail closed at database engine level.                      |
| **IDOR Protection**            | Server-side actor context validation in every query         | **PASS** — College and club access helpers verify session ownership, never request params. |
| **Authentication Enforcement** | Better Auth + `getCurrentUser()` with PostgreSQL reload     | **PASS** — Disabled/suspended users fail authentication immediately.                       |
| **CSRF Protection**            | `assertSameOrigin` assertion on all Server Actions          | **PASS** — Validates origin and host headers on every mutation.                            |
| **Secret Protection**          | Zero secrets rendered in UI, audit logs, or error responses | **PASS** — Credentials, hashes, and connection strings are strictly masked.                |
| **Role Privilege Elevation**   | Server actions verify caller role before role changes       | **PASS** — `SUPER_ADMIN` elevation cannot be executed by lower roles.                      |

---

## 6. Identified Gaps & Required Implementation Tasks

1. **Centralized Settings Experience (`/account` and Dashboards):**
   - Add inline **Change Password** form for authenticated users.
   - Add **Active Sessions Management** table with ability to revoke individual sessions.
   - Add **Appearance / Theme Switcher** (Light / Dark / System) with CSS dark theme variables and persistent client storage.
   - Add **Notification Preferences** tab on `/account`.
   - Add **Settings** navigation links in `DashboardShell` and student navigation.
2. **QR Scanner & Attendance Access for Administrators:**
   - Update `requireDashboardRole` or attendance access logic so `SUPER_ADMIN` and `COLLEGE_ADMIN` can access and test the QR attendance scanner for events without being redirected to `/platform`.
3. **Web UI for Creating Colleges (`/platform/colleges`):**
   - Provide an inline "Create College" modal/form in the Platform Dashboard so Super Admins can onboard colleges via the web interface in addition to the CLI bootstrap script.
4. **Member Roster in Club Settings (`/club/settings`):**
   - Provide a member roster view in club settings displaying authorized managers and member counts.
5. **Theme Support (`globals.css`):**
   - Implement dark mode CSS token overrides and theme initialization script.
