# CampusPulse

## Software Requirements Specification (SRS)

**Course Code:** INT257 (paired with INT252)  
**Course Name:** Advanced Backend Programming (Next.js)  
**Prepared for:** Continuous Assessment 3 (CA3)  
**Academic Term:** Autumn 2026  
**Institution:** School of Computer Science and Engineering, Lovely Professional University, Phagwara, Punjab

---

### Team Details (Group Project — 4 Members)

| Student Name      | Student Registration No. | Role / Responsibility                      |
| :---------------- | :----------------------- | :----------------------------------------- |
| **Piyush Singh**  | **12420010**             | Lead Architecture, Security & Governance   |
| **Team Member 2** | _(Registration No.)_     | Club Operations & Media Intelligence       |
| **Team Member 3** | _(Registration No.)_     | Student Experience & Algorithms            |
| **Team Member 4** | _(Registration No.)_     | College Administration & Quality Assurance |

---

## Table of Contents

- **Revision History** .................................................................................................................... ii
- **1. Introduction** ........................................................................................................................ 1
  - 1.1 Purpose ........................................................................................................................ 1
  - 1.2 Scope ........................................................................................................................... 1
  - 1.3 Definitions, Acronyms, and Abbreviations .................................................................... 1
  - 1.4 References ................................................................................................................... 2
  - 1.5 Overview ...................................................................................................................... 2
- **2. General Description** ............................................................................................................. 3
  - 2.1 Product Perspective ...................................................................................................... 3
  - 2.2 Product Functions ........................................................................................................ 3
  - 2.3 User Characteristics ..................................................................................................... 4
  - 2.4 General Constraints ..................................................................................................... 4
  - 2.5 Assumptions and Dependencies ................................................................................... 5
- **3. Specific Requirements** ........................................................................................................ 6
  - 3.1 External Interface Requirements .................................................................................. 6
    - 3.1.1 User Interfaces .................................................................................................... 6
    - 3.1.2 Hardware Interfaces ............................................................................................ 6
    - 3.1.3 Software Interfaces ............................................................................................. 7
    - 3.1.4 Communications Interfaces ................................................................................ 7
  - 3.2 Functional Requirements ............................................................................................. 8
    - 3.2.1 Multi-Tenant Organization & Tenant Provisioning .............................................. 8
    - 3.2.2 User Authentication, Argon2id Passwords & Session Governance ....................... 9
    - 3.2.3 Student Event Discovery, Search & Recommendations ..................................... 10
    - 3.2.4 Event Capacity, Registration & Cancellation FSM ............................................ 11
    - 3.2.5 Event Proposal Drafting, Conflict Detection & Moderation Queue ...................... 12
    - 3.2.6 Poster Artwork Upload, S3 Storage & Tesseract OCR Pipeline ............................ 13
    - 3.2.7 Cryptographic Attendance QR Issuance & Live Camera Scanning ....................... 14
    - 3.2.8 Verified Attendee Feedback & Comment Moderation ........................................ 15
    - 3.2.9 In-Database Token-Bucket Rate Limiting & Sensitive Data Exports ................... 16
  - 3.5 Non-Functional Requirements ................................................................................... 17
    - 3.5.1 Performance ..................................................................................................... 17
    - 3.5.2 Reliability .......................................................................................................... 17
    - 3.5.3 Availability ......................................................................................................... 18
    - 3.5.4 Security ............................................................................................................. 18
    - 3.5.5 Maintainability ................................................................................................... 18
    - 3.5.6 Portability .......................................................................................................... 19
  - 3.7 Design Constraints ..................................................................................................... 19
  - 3.9 Other Requirements ................................................................................................... 19
- **4. Analysis Models** ................................................................................................................. 20
  - 4.1 Data Flow Diagrams (DFD) ........................................................................................ 20
    - 4.1.1 DFD Level 0 (Context Diagram) ......................................................................... 20
    - 4.1.2 DFD Level 1 (Core Functional Modules) ............................................................ 21
    - 4.1.3 DFD Level 2 (Attendance QR Verification & Ticket Check-In) ........................... 22
- **5. GitHub Link** ....................................................................................................................... 23
- **6. Deployed Link** ................................................................................................................... 23

---

## Revision History

| Version |    Date     | Description of Changes                                                                                                         | Author(s)     |
| :-----: | :---------: | :----------------------------------------------------------------------------------------------------------------------------- | :------------ |
| **0.1** | 24 Oct 2026 | Initial draft of core functional requirements, user actors, and database entities.                                             | Piyush Singh  |
| **0.2** | 08 Nov 2026 | Added cryptographic QR ticket specification, S3 poster storage pipeline, and OCR specs.                                        | Team Member 2 |
| **0.3** | 18 Nov 2026 | Specified schedule conflict algorithm, recommendation scoring, and DFD analysis models.                                        | Team Member 3 |
| **1.0** | 24 Nov 2026 | Complete formal SRS baseline for CA3: verified non-functional metrics, Next.js 16 APIs, and multi-tenant security constraints. | All Members   |

---

<div style="page-break-after: always;"></div>

## 1. Introduction

This document adheres to the IEEE Recommended Practice for Software Requirements Specifications (IEEE Std 830-1998) adapted for modern full-stack web applications. It serves as the authoritative technical and functional baseline for **CampusPulse**, specifying all requirements necessary to design, implement, test, and audit the software product.

### 1.1 Purpose

The purpose of this Software Requirements Specification (SRS) is to provide an unambiguous, complete, and verifiable description of the functional, non-functional, interface, and architectural requirements for **CampusPulse**.

The intended audience includes:

- **Software Engineers & Backend Developers:** To implement application routes, server actions, services, and database queries.
- **Academic Evaluators & Course Instructors (INT257 / INT252):** To evaluate architectural compliance, database normalization, multi-tenant security, and coding rigor for Continuous Assessment 3.
- **Quality Assurance & Test Automation Engineers:** To author unit, integration, and end-to-end test scenarios against verifiable criteria.
- **Campus System Administrators & IT Operators:** To configure production cloud services, deploy database migrations, and manage university tenants.

### 1.2 Scope

CampusPulse is a cloud-native, multi-tenant campus event discovery and management platform.

#### Software Product Identification

- **Name:** CampusPulse (Campus Event Discovery & Governance Platform)
- **Runtime Environment:** Next.js 16 (App Router with Turbopack), Node.js $\ge 20.19.0$, PostgreSQL 17 (Neon Serverless), Supabase S3 Storage.

#### What the Software Will Do:

1. Provide role-scoped workspaces for four distinct personas: **Students**, **Club Administrators**, **College Administrators**, and **Platform Super Admins**.
2. Isolate university tenant data completely using logical foreign-key scoping (`collegeId`), ensuring zero cross-campus data leakage.
3. Allow student clubs to submit event proposals, upload promotional artwork, and automatically extract date, venue, and title details via client/server OCR.
4. Programmatically detect schedule clashes and duplicate proposals across campus venues before college approval.
5. Generate dynamic, single-use, cryptographic HMAC-signed QR tickets for registered students.
6. Provide a browser-based live camera QR scanner for organizers to check in attendees with atomic single check-in guarantees.
7. Support RFC 5545 iCalendar (`.ics`) personal calendar exports and injection-safe CSV attendance rosters.
8. Deliver a unified settings center (`/account`) with Argon2id password rotation, active session management, and persistent dark mode styling.

#### What the Software Will NOT Do:

1. The platform will not process monetary ticket payments or financial transactions (all campus events are free-entry or institutional).
2. The platform will not store biometric data; attendance check-in is strictly verified via cryptographic QR credential binding.
3. The platform will not permit cross-university communication or cross-tenant event registrations without explicit multi-campus federations.

### 1.3 Definitions, Acronyms, and Abbreviations

- **Argon2id:** Memory-hard cryptographic key derivation function utilized for password hashing (RFC 9106).
- **CA2 / CA3:** Continuous Assessment 2 / Continuous Assessment 3 (Academic evaluation components at Lovely Professional University).
- **DFD:** Data Flow Diagram (Graph representation of system data flow and transformations).
- **FSM:** Finite State Machine (Model of event and registration lifecycle state transitions).
- **HMAC:** Hash-Based Message Authentication Code (Cryptographic mechanism for signing attendance tokens).
- **OCR:** Optical Character Recognition (Extracting digitized text from raster image posters via Tesseract.js).
- **RBAC:** Role-Based Access Control (Access restriction based on authenticated user roles).
- **RLS:** Row-Level Security (PostgreSQL security policy restricting row access based on session attributes).
- **RSC:** React Server Components (Server-rendered non-interactive UI primitives in React 19).
- **SRS:** Software Requirements Specification (Formal IEEE specification document).
- **Tenant:** An independent educational institution (e.g. Lovely Professional University) possessing dedicated users, clubs, and events.

### 1.4 References

1. **IEEE Std 830-1998:** _IEEE Recommended Practice for Software Requirements Specifications._ IEEE Computer Society, 1998.
2. **Vercel Inc.:** _Next.js 16 App Router & Server Actions Documentation._ `https://nextjs.org/docs`
3. **Prisma Data, Inc.:** _Prisma 7 Client & Driver Adapters Specification._ `https://www.prisma.io/docs`
4. **Neon, Inc.:** _Neon Serverless PostgreSQL 17 Architecture._ `https://neon.tech/docs`
5. **Better Auth:** _Better Auth: The Modern TypeScript Authentication Framework._ `https://www.better-auth.com/docs`
6. **IETF RFC 5545:** _Internet Calendaring and Scheduling Core Object Specification (iCalendar)._
7. **Lovely Professional University:** _Syllabus and Assessment Guidelines for INT257 and INT252 (2026)._

### 1.5 Overview

The remainder of this SRS is organized into three major sections:

- **Section 2 (General Description):** Explains product perspective, user characteristics, general system constraints, and operating assumptions.
- **Section 3 (Specific Requirements):** Detailed external interface requirements, structured functional requirements (with inputs, processing, outputs, and error handling), and measurable non-functional metrics.
- **Section 4 (Analysis Models):** Formal Data Flow Diagrams (DFD Level 0, Level 1, Level 2).
- **Sections 5 & 6:** Repository and deployment links.

---

<div style="page-break-after: always;"></div>

## 2. General Description

### 2.1 Product Perspective

CampusPulse operates as a self-contained, cloud-hosted web system replacing fragmented third-party utilities (Google Forms, WhatsApp groups, manual paper rosters).

```
+---------------------------------------------------------------------------------------+
|                                    CAMPUSPULSE PLATFORM                               |
|                                                                                       |
|  [ End-User Interfaces ]                                                              |
|    - Public Landing & Discovery                                                       |
|    - Student Workspace (/student)                                                     |
|    - Club Operations Portal (/club)                                                   |
|    - College Administration (/college)                                                |
|    - Platform Multi-Tenant Console (/platform)                                        |
|    - Unified Settings Center (/account)                                               |
+-------------------------------------------+-------------------------------------------+
                                            |
                         +------------------+------------------+
                         |                                     |
                         v                                     v
+-----------------------------------------------+  +------------------------------------+
|               NEON POSTGRESQL 17              |  |         SUPABASE S3 STORAGE        |
| - 19 Relational Models                        |  | - Private event poster buckets     |
| - In-Database Token-Bucket Rate Limiter       |  | - Signed image upload/read URLs    |
| - Immutable Audit Logging Table               |  | - Automatic orphan asset cleanup   |
| - Row-Level Foreign-Key Tenant Scoping        |  +------------------------------------+
+-----------------------------------------------+
```

### 2.2 Product Functions

The high-level functions of CampusPulse include:

1. **Multi-Tenant Administration:** Provisioning independent university organizations with unique slugs, primary email domains, and IANA timezones.
2. **Identity & Credential Protection:** Self-service registration matching university email domains, Argon2id password hashing, and real-time active session revocation.
3. **Event Lifecycle Governance:** Multi-step event drafting, S3 poster storage, Tesseract OCR text extraction, schedule clash analysis, and administrative approval/rejection queues.
4. **Intelligent Discovery & Recommendations:** Deterministic ranking based on explicit student interests, department alignment, and event recency decay.
5. **Cryptographic QR Attendance & Check-in:** Generating tamper-evident HMAC check-in tokens, validating a 4-hour check-in window, and processing live camera scans via `jsQR`.
6. **Governance & Compliance:** Immutable transactional audit logging, rate-limit defense against brute-force attacks, and formula-injection-safe CSV data exports.

### 2.3 User Characteristics

The platform caters to four distinct user classes with varying technical proficiency:

1. **Student (`STUDENT`):**
   - _Profile:_ University students browsing events on mobile devices or laptops.
   - _Technical Expertise:_ General web users requiring intuitive navigation, fast mobile rendering, high accessibility, and instant QR generation.
2. **Club Administrator (`CLUB_ADMIN`):**
   - _Profile:_ Student club presidents, vice presidents, and event organizers.
   - _Technical Expertise:_ Intermediate users who draft event notices, upload promotional banners, monitor registrations, and operate the live camera QR scanner at venue entrances.
3. **College Administrator (`COLLEGE_ADMIN`):**
   - _Profile:_ University faculty, student welfare deans, and academic coordinators.
   - _Technical Expertise:_ Administrative staff reviewing event proposals, resolving room collisions, moderating feedback, and exporting compliance reports.
4. **Platform Administrator (`SUPER_ADMIN`):**
   - _Profile:_ System operators and platform engineers.
   - _Technical Expertise:_ Advanced technical operators configuring university tenants, monitoring global audit streams, managing database migrations, and provisioning first-run bootstrap credentials.

### 2.4 General Constraints

1. **Zero-Cost Free-Tier Architecture:** The system must execute cleanly within free-tier resource limits: Vercel Hobby (serverless compute), Neon PostgreSQL Free Tier (0.5 GB storage, connection pooling), and Supabase Storage Free Tier (1 GB storage).
2. **Strict Multi-Tenant Separation:** Data belonging to different colleges must never be co-mingled in application views or export streams. Cross-tenant access must return HTTP 404.
3. **Cryptographic Ticket Anti-Replay:** Attendance QR codes must prevent screenshot sharing, ticket re-use, and unauthorized ticket scanning outside the event window.
4. **No Plaintext Credential Exposure:** Passwords, database connection strings, Better Auth secrets, and API keys must never appear in logs, error payloads, or client bundles.
5. **Browser Camera Compatibility:** Camera scanning functionality must operate directly within modern web browsers (Chrome, Safari, Firefox, Edge) using HTML5 `getUserMedia` and `jsQR` without requiring external mobile apps.

### 2.5 Assumptions and Dependencies

1. **Network Connectivity:** Users are assumed to possess intermittent or active Internet connectivity.
2. **Modern Web Standards:** Client browsers must support HTML5 Canvas, MediaStream APIs (`navigator.mediaDevices.getUserMedia`), ECMAScript 2022, and modern CSS variables.
3. **PostgreSQL Availability:** Relational persistence relies on Neon PostgreSQL 17 serverless availability with SSL mode enabled (`sslmode=require`).
4. **Node.js LTS Runtime:** Server execution assumes Node.js runtime version $\ge 20.19.0$.

---

<div style="page-break-after: always;"></div>

## 3. Specific Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces

- **Responsive Layout:** The application shall render seamlessly across mobile viewports (360px–390px), tablets (768px–1024px), and desktop displays ($\ge 1280\text{px}$).
- **Semantic Theme Palette:** Built using Tailwind CSS with dedicated light and dark mode tokens (`--color-canvas`, `--color-paper`, `--color-ink`, `--color-forest`, `--color-signal`).
- **Flash-Free Hydration:** The UI shall inject an inline pre-hydration script in `RootLayout` reading `localStorage.getItem("campuspulse-theme")` to eliminate white-screen flashing on dark mode.
- **Dashboard Navigation Shell:** A unified `DashboardShell` providing role-scoped breadcrumbs, college branding, mobile navigation drawer, skip-to-content accessibility links, and a direct link to `/account`.

#### 3.1.2 Hardware Interfaces

- **Camera Device:** The attendance check-in module shall interface with client camera hardware via HTML5 `MediaDevices.getUserMedia({ video: { facingMode: "environment" } })` to capture video frames for real-time QR code decoding.

#### 3.1.3 Software Interfaces

- **Neon PostgreSQL 17:** Connected via Prisma PgAdapter (`@prisma/adapter-pg`) using pooled TCP connections with mandatory SSL encryption.
- **Supabase S3 Storage:** Interfaced via AWS S3 SDK protocol for presigned upload URLs and secure object streaming.
- **Tesseract.js Engine:** Local WebAssembly/Node worker execution for optical character recognition on event poster images.
- **Better Auth Framework:** Interfaced via server cookies for session validation, user registration, and Argon2id credential hashing.

#### 3.1.4 Communications Interfaces

- **Protocol:** All client-server communications shall execute exclusively over HTTPS (TLS 1.3).
- **Server Actions:** Mutations shall use Next.js Server Actions with strict Origin and Host verification to prevent Cross-Site Request Forgery (CSRF).
- **Data Formats:** API responses and Server Action states shall transmit structured JSON. Calendar endpoints shall deliver RFC 5545 `text/calendar` payloads. Attendance exports shall deliver RFC 4180 `text/csv` payloads.

---

<div style="page-break-after: always;"></div>

### 3.2 Functional Requirements

#### 3.2.1 Multi-Tenant Organization & Tenant Provisioning

- **3.2.1.1 Introduction:** Enables Platform Super Admins to provision, configure, suspend, or archive university tenant organizations.
- **3.2.1.2 Inputs:**
  - `name`: String, 2 to 160 characters (e.g. "Lovely Professional University").
  - `slug`: String, 2 to 80 characters, lowercase alphanumeric with hyphens (e.g. "lpu").
  - `shortName`: Optional string, max 48 characters (e.g. "LPU").
  - `primaryDomain`: Optional valid domain string (e.g. "lpu.in").
  - `timezone`: Valid IANA timezone string (e.g. "Asia/Kolkata").
- **3.2.1.3 Processing:**
  1. Verify caller has `role === 'SUPER_ADMIN'`.
  2. Validate timezone using `Intl.DateTimeFormat`.
  3. Query `College` table to ensure `slug` and `primaryDomain` are unique across all tenants.
  4. In an atomic transaction, insert `College` record in `ACTIVE` status.
  5. Write an immutable `COLLEGE_CREATED` audit log entry in `AuditLog`.
- **3.2.1.4 Outputs:** Created `College` object with ID, name, slug, and status. Success confirmation in UI.
- **3.2.1.5 Error Handling:**
  - If caller is unauthorized: throw `ActorNotAuthorizedError` (HTTP 403).
  - If slug or domain exists: throw `DomainError("CONFLICT", "College slug or domain already exists.", 409)`.
  - If timezone is invalid: throw `InvalidInputError("Choose a valid IANA timezone.")`.

#### 3.2.2 User Authentication, Argon2id Passwords & Session Governance

- **3.2.2.1 Introduction:** Manages student registration, credential verification, password rotation, and active session termination.
- **3.2.2.2 Inputs:**
  - Registration: `name`, `email`, `password`, `collegeId`.
  - Login: `email`, `password`.
  - Password Change: `currentPassword`, `newPassword` (min 8 chars, 1 uppercase, 1 lowercase, 1 number).
  - Session Revoke: `sessionId`.
- **3.2.2.3 Processing:**
  1. On registration: verify email domain matches college's `primaryDomain`; hash password using Argon2id (`@node-rs/argon2`); insert `User`, `Account`, and `StudentProfile` transactionally.
  2. On login: verify Argon2id hash in constant time; create `Session` row; return signed `HttpOnly`, `SameSite=Lax` cookie.
  3. On password change: verify existing password hash; update to new Argon2id hash; revoke all remote sessions; log `PASSWORD_CHANGED` audit record.
  4. On session revocation: delete specific `Session` record from database.
- **3.2.2.4 Outputs:** Authenticated session cookie; active sessions list in `/account`; success/error feedback.
- **3.2.2.5 Error Handling:**
  - Invalid credentials: return unified error message ("Invalid email or password") to prevent account enumeration.
  - Rate limit exceeded: return HTTP 429 Retry After.

#### 3.2.3 Student Event Discovery, Search & Recommendations

- **3.2.3.1 Introduction:** Provides students with a searchable, categorized event directory with personalized recommendation scoring.
- **3.2.3.2 Inputs:**
  - Search query `q`, category slug `category`, date filter `date` (`today`, `this_week`, `upcoming`), page number `page`.
- **3.2.3.3 Processing:**
  1. Load student's verified `collegeId` from server session.
  2. Filter `Event` table: `collegeId === student.collegeId`, `deletedAt === null`, `status === 'PUBLISHED'`.
  3. Calculate recommendation score for each event:
     $$\text{Score} = 100 + 30 \times |\text{Interest Overlap}| + 20 \times \mathbf{1}_{\{\text{Dept Match}\}} - 2 \times \text{Days Until Start}$$
  4. Filter out full events, cancelled events, and events the student has already registered for.
- **3.2.3.4 Outputs:** Paginated list of recommended and categorized events with title, date, venue, capacity, and registration status.
- **3.2.3.5 Error Handling:**
  - Invalid search parameters: gracefully fall back to default upcoming events list without throwing exceptions.

#### 3.2.4 Event Capacity, Registration & Cancellation FSM

- **3.2.4.1 Introduction:** Manages student event registrations and cancellations with atomic capacity constraints and concurrency locks.
- **3.2.4.2 Inputs:** `eventId` (UUID).
- **3.2.4.3 Processing:**
  1. In a PostgreSQL transaction, query `Event` row with row locking.
  2. Verify `event.status === 'PUBLISHED'` and `event.startsAt > NOW()`.
  3. Verify student does not already hold a registration for `eventId`.
  4. Count confirmed registrations; verify count $< \text{capacity}$ (or capacity is null/unlimited).
  5. Insert `EventRegistration` in `CONFIRMED` status.
  6. Write `REGISTRATION_STATUS_CHANGED` audit log entry.
- **3.2.4.4 Outputs:** `EventRegistration` record; confirmation email/in-app alert; updated available seat counter.
- **3.2.4.5 Error Handling:**
  - If event is at capacity: throw `DomainError("EVENT_FULL", "Event capacity has been reached.", 409)`.
  - If student already registered: throw `DomainError("DUPLICATE_REGISTRATION", "Already registered.", 409)`.

#### 3.2.5 Event Proposal Drafting, Conflict Detection & Moderation Queue

- **3.2.5.1 Introduction:** Allows club organizers to draft event proposals, flags schedule collisions, and routes proposals to college administrators.
- **3.2.5.2 Inputs:** `title`, `summary`, `description`, `startsAt`, `endsAt`, `venueName`, `capacity`, `categoryIds`.
- **3.2.5.3 Processing:**
  1. Verify caller has active `PRESIDENT` or `OFFICER` membership in owning club.
  2. Analyze time interval $[\text{startsAt}, \text{endsAt}]$ against all existing college events at the same venue.
  3. If overlapping interval detected, generate `DuplicateReview` record linking colliding events.
  4. On submit, transition status from `DRAFT` to `PENDING_APPROVAL`.
  5. Notify college administrators of pending proposal.
- **3.2.5.4 Outputs:** Created `Event` draft; collision warning cards; moderation queue item in `/college/approvals`.
- **3.2.5.5 Error Handling:**
  - If `endsAt <= startsAt`: throw `InvalidInputError("End date must be after start date.")`.
  - If club is inactive: throw `DomainError("CLUB_INACTIVE", "Inactive clubs cannot create events.", 403)`.

#### 3.2.6 Poster Artwork Upload, S3 Storage & Tesseract OCR Pipeline

- **3.2.6.1 Introduction:** Validates promotional posters, uploads to private S3 buckets, and runs optical character recognition to assist event creation.
- **3.2.6.2 Inputs:** Image file (`multipart/form-data`), `eventId`.
- **3.2.6.3 Processing:**
  1. Check file size ($\le 4\text{ MB}$, compliant with Vercel body cap).
  2. Inspect binary magic bytes to guarantee file is authentic JPEG, PNG, or WebP. Strip/prohibit SVG to prevent stored XSS.
  3. Stream binary buffer to Supabase S3 bucket under path `{collegeId}/events/{eventId}/{uuid}.{ext}`.
  4. Insert `EventPoster` record in `ocrStatus = 'PENDING'`.
  5. Invoke Tesseract.js worker to extract textual information; update `ocrText` and set `ocrStatus = 'COMPLETED'`.
- **3.2.6.4 Outputs:** Stored `EventPoster` entity with S3 storage key; extracted date/venue review suggestions.
- **3.2.6.5 Error Handling:**
  - Corrupt or disguised files: throw `InvalidInputError("File contents do not match allowed image formats.")`.
  - OCR failure or timeout: record `ocrStatus = 'FAILED'` and enforce cooldown without aborting poster upload.

#### 3.2.7 Cryptographic Attendance QR Issuance & Live Camera Scanning

- **3.2.7.1 Introduction:** Generates single-use HMAC-signed QR check-in tokens for students and enables organizers to scan and mark attendance in real time.
- **3.2.7.2 Inputs:**
  - Issuance: `registrationId`.
  - Scan: `eventId`, `token` (scanned QR string).
  - Manual correction: `registrationId`, `status` (`ATTENDED` / `NO_SHOW`), `reason` (3–500 chars).
- **3.2.7.3 Processing:**
  1. On issuance: verify caller owns registration; generate token containing `registrationId` and HMAC-SHA256 signature; store hash in `AttendanceCredential`.
  2. On scan: verify token HMAC signature; verify event check-in window ($[\text{startsAt} - 2\text{h},\; \text{endsAt} + 2\text{h}]$).
  3. In an atomic transaction, update `EventRegistration` status from `CONFIRMED` to `ATTENDED` and set `checkedInAt = NOW()`.
  4. Write `ATTENDANCE_RECORDED` audit log entry.
- **3.2.7.4 Outputs:** Scanned attendee verification banner (Student Name, Roll Number, Timestamp); updated attendance count metrics.
- **3.2.7.5 Error Handling:**
  - Expired token: throw `DomainError("EXPIRED_TOKEN", "Check-in window is closed.", 400)`.
  - Duplicate scan: throw `DomainError("ALREADY_CHECKED_IN", "Attendee has already checked in.", 409)`.

#### 3.2.8 Verified Attendee Feedback & Comment Moderation

- **3.2.8.1 Introduction:** Collects star ratings and qualitative reviews exclusively from verified attendees who checked in.
- **3.2.8.2 Inputs:** `eventId`, `rating` (integer 1–5), `comment` (optional, max 1000 chars), `isPublic` (boolean).
- **3.2.8.3 Processing:**
  1. Verify caller has `EventRegistration` with `status === 'ATTENDED'`.
  2. Verify event has completed and within 30-day feedback window.
  3. Verify student has not already submitted feedback for `eventId`.
  4. Insert `Feedback` record in `moderationStatus = 'PENDING'`.
- **3.2.8.4 Outputs:** Recorded `Feedback` entity; aggregated club performance rating metrics.
- **3.2.8.5 Error Handling:**
  - Unattended user: throw `ActorNotAuthorizedError("Feedback is restricted to verified attendees.")`.
  - Rating out of range: throw `InvalidInputError("Rating must be between 1 and 5.")`.

#### 3.2.9 In-Database Token-Bucket Rate Limiting & Sensitive Data Exports

- **3.2.9.1 Introduction:** Defends sensitive endpoints against automated brute-force attacks and generates injection-safe attendance/analytics CSVs.
- **3.2.9.2 Inputs:** Request IP, user ID, export query parameters.
- **3.2.9.3 Processing:**
  1. Rate Limiting: In PostgreSQL `RateLimit` table, atomically decrement bucket tokens. If tokens $< 1$, throw 429. Fails closed on database errors.
  2. CSV Export: Sanitize every cell; if cell begins with `=`, `+`, `-`, or `@`, prepend a tab character `\t` to prevent formula execution in Microsoft Excel.
  3. Set HTTP headers: `Content-Type: text/csv`, `Cache-Control: private, no-store`.
  4. Record `EXPORT_DOWNLOADED` audit log entry with row count.
- **3.2.9.4 Outputs:** Streaming CSV download response or 429 Too Many Requests response.
- **3.2.9.5 Error Handling:**
  - Unauthorized role calling export: throw `ActorNotAuthorizedError` (HTTP 403).

---

<div style="page-break-after: always;"></div>

### 3.5 Non-Functional Requirements

#### 3.5.1 Performance

- **3.5.1.1 Page Load Latency:** Server-rendered dashboard pages (RSC) shall deliver the first contentful paint (FCP) in under **$800\text{ ms}$** under standard broadband conditions.
- **3.5.1.2 Database Query Execution:** 95% of read queries shall complete in under **$50\text{ ms}$** through indexed composite lookups.
- **3.5.1.3 Camera Scanner Throughput:** The live QR camera scanner shall decode and verify attendee check-in tokens with an end-to-end response time of less than **$250\text{ ms}$** per attendee.
- **3.5.1.4 Build Optimization:** Production build compilation (`next build` with Turbopack) shall optimize all 42 routes in under **$40\text{ seconds}$**.

#### 3.5.2 Reliability

- **3.5.2.1 Atomic Transactional Integrity:** State transitions spanning multiple tables (registration + capacity, attendance + credential, college + audit) shall execute in atomic transactions (`runInTransaction`), guaranteeing zero partial or half-saved records upon server failure.
- **3.5.2.2 Fail-Closed Rate Limiting:** If the rate-limiting query encounters an unexpected database timeout, the system shall fail closed (denying the request) to protect system integrity.
- **3.5.2.3 Idempotent Operations:** Repeated submissions of identical mutations (e.g. repeated QR scans or double-clicks on bookmark toggles) shall be handled idempotently without throwing unhandled exceptions.

#### 3.5.3 Availability

- **3.5.3.1 Service Uptime:** The platform shall target **$99.9\%$ uptime**, backed by Vercel serverless edge nodes and Neon PostgreSQL serverless compute with automated multi-zone failover.
- **3.5.3.2 Automated Health Monitoring:** The `/api/health` endpoint shall execute an active `SELECT 1` query and return structured JSON health status with an HTTP 200 within **$100\text{ ms}$**.

#### 3.5.4 Security

- **3.5.4.1 Password Storage:** Passwords shall be encrypted exclusively using memory-hard **Argon2id** with salt generation managed by `@node-rs/argon2`. Plaintext passwords shall never be persisted or logged.
- **3.5.4.2 Tenant Isolation Guarantee:** Every operational query shall be scoped by `collegeId`. Cross-tenant record requests shall return HTTP 404 (`TenantIsolationError`) to prevent resource enumeration.
- **3.5.4.3 Anti-Replay QR Tokens:** QR tokens shall incorporate registration IDs, issuance timestamps, and HMAC-SHA256 signatures, valid strictly within a 4-hour event check-in window.
- **3.5.4.4 Session Invalidation:** Modifying a user's role or suspending a college tenant shall immediately purge all corresponding session tokens from the `Session` table.
- **3.5.4.5 Formula Injection Defense:** All generated CSV export files shall neutralize dynamic spreadsheet formulas by escaping leading character triggers.

#### 3.5.5 Maintainability

- **3.5.5.1 Strict Static Typing:** The codebase shall maintain 100% strict TypeScript typing (`tsc --noEmit`), with zero implicit `any` definitions.
- **3.5.5.2 Automated Test Coverage:** The project shall maintain a continuous integration test suite comprising at least 30 test files and over 200 automated unit/integration tests covering all services.
- **3.5.5.3 Schema Migration Tracking:** All database modifications shall be recorded in ordered Prisma migrations in `prisma/migrations/`.

#### 3.5.6 Portability

- **3.5.6.1 Cloud-Agnostic Containers:** The application shall run without code modifications on any Node.js $\ge 20.19.0$ host, Docker container, Vercel Serverless environment, or AWS ECS instance.
- **3.5.6.2 Standards-Compliant SQL:** Database structures shall adhere to ANSI SQL standards supported by PostgreSQL 16 and 17.

### 3.7 Design Constraints

- **Zero-Cost Deployment:** The architecture is strictly constrained to free-tier cloud configurations: Vercel Hobby + Neon PostgreSQL Free (0.5 GB) + Supabase Storage Free (1 GB).
- **No Third-Party Paid APIs:** All core features (OCR, QR encoding/decoding, recommendation scoring, conflict detection) must execute via open-source in-process libraries (Tesseract.js, jsQR, Prisma) without paid external microservice dependencies.

### 3.9 Other Requirements

- **Audit Non-Repudiation:** All critical operational actions (`COLLEGE_CREATED`, `USER_ROLE_CHANGED`, `EVENT_APPROVED`, `ATTENDANCE_RECORDED`) shall be written to an immutable `AuditLog` table with actor ID, timestamp, and redacted JSON metadata.
- **Accessibility Compliance:** The frontend shall adhere to WCAG 2.1 Level AA accessibility standards, featuring high-contrast color ratios, aria labels, and keyboard-focusable controls.

---

<div style="page-break-after: always;"></div>

## 4. Analysis Models

### 4.1 Data Flow Diagrams (DFD)

#### 4.1.1 DFD Level 0 (Context Diagram)

The Level 0 context diagram models the overall CampusPulse system interacting with its external actors:

```
                  +----------------------------------------------+
                  |                   STUDENT                    |
                  +----------------------------------------------+
                     |                          ^
     Registration /  |                          | Event Catalog /
     Ticket Request  |                          | QR Attendance Pass
                     v                          |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|                                0. CAMPUSPULSE SYSTEM                                  |
|                                                                                       |
+---------------------------------------------------------------------------------------+
    ^                    |                                    ^                     ^
    | Event Proposals /  | Attendee Roster /                  | Event Approvals /   | Tenant Provisioning /
    | Poster Uploads     | Scan Confirmations                 | Moderation Decisions| Lifecycle Policies
    |                    v                                    |                     |
+------------------------------------+            +--------------------+  +--------------------+
|             CLUB ADMIN             |            |   COLLEGE ADMIN    |  |    SUPER ADMIN     |
+------------------------------------+            +--------------------+  +--------------------+
```

#### 4.1.2 DFD Level 1 (Core Functional Modules)

```
                    +------------------------------------+
                    |        1.0 AUTHENTICATION          |
                    |    Better Auth / Argon2id / Cookie |
                    +------------------------------------+
                                      |
                      +---------------+---------------+
                      | (Authenticated Actor Context) |
                      v                               v
+------------------------------------+    +------------------------------------+
|        2.0 EVENT LIFECYCLE         |    |      3.0 DISCOVERY & BOOKING       |
|  Draft, Poster OCR, Clash Review,  |    |  Recommendations, Schedule Sync,   |
|      Approval FSM Transitions      |    |        Capacity Reservation        |
+------------------------------------+    +------------------------------------+
                  |                                           |
                  +-------------------+   +-------------------+
                                      |   |
                                      v   v
                    +------------------------------------+
                    |    4.0 CRYPTOGRAPHIC ATTENDANCE    |
                    |  Token Signing, Live Camera Scan,  |
                    |     Single-Use Check-in Commit     |
                    +------------------------------------+
                                      |
                                      v
                    +------------------------------------+
                    |     5.0 GOVERNANCE & AUDITING      |
                    |   PostgreSQL Rate Limits, Tenant   |
                    |    Isolation, Immutable Logs       |
                    +------------------------------------+
```

#### 4.1.3 DFD Level 2 (Attendance QR Verification & Ticket Check-In)

```
[ Student ] ----> Request Pass ----> ( 4.1 Generate QR ) ----> Signs Token with HMAC-SHA256
                                                                          |
                                                                          v
[ Club Admin ] ---> Camera Scan ---> ( 4.2 Decode Frame) <--- Reads QR from Screen via jsQR
                                              |
                                              v
                                     ( 4.3 Validate Window ) -> Check: startsAt - 2h <= NOW <= endsAt + 2h
                                              |
                                              v
                                     ( 4.4 Atomic Commit ) ---> UPDATE EventRegistration
                                              |                 SET status = 'ATTENDED', checkedInAt = NOW()
                                              |                 WHERE status = 'CONFIRMED'
                                              v
                                     ( 4.5 Record Audit ) ----> INSERT INTO AuditLog (ATTENDANCE_RECORDED)
                                              |
                                              v
                                     Displays Success Notification on Camera View
```

---

<div style="page-break-after: always;"></div>

## 5. GitHub Link

The complete production source code, Prisma database migrations, automated Vitest test suite, and architectural documentation are publicly maintained at:

🔗 **Git Repository:** `https://github.com/piyushsingh/campuspulse`

---

## 6. Deployed Link

The live, production-compiled CampusPulse application with active PostgreSQL multi-tenant database connection is deployed at:

🌐 **Deployed Application:** `https://campuspulse.vercel.app`  
💻 **Local Development Instance:** `http://localhost:3000`
