# CampusPulse — Security Architecture & Production Audit Report

**Date:** November 2026  
**Auditor:** CampusPulse Engineering Architecture Review  
**Classification:** Technical Security Audit  
**Status:** PASS — Zero Critical Vulnerabilities

---

## 1. Multi-Tenant Data Isolation

### 1.1 Architectural Guarantees

CampusPulse employs a shared-database, shared-schema multi-tenant architecture with mandatory logical isolation:

- Every tenant-scoped entity (`Club`, `Event`, `EventRegistration`, `StudentProfile`, `SavedEvent`, `AuditLog`, `Feedback`, `Category`, `DuplicateReview`) includes a foreign key constraint referencing `College(id)`.
- **Query Scoping:** Service queries never rely on client-supplied `collegeId` parameters. In every authenticated request, `loadActorContext` fetches the actor's verified `collegeId` directly from the `User` table.
- **Tenant Isolation Error:** When a user requests an ID belonging to a different tenant, the application raises `TenantIsolationError` which maps to HTTP `404 Not Found` rather than `403 Forbidden`, preventing resource enumeration across tenants.

---

## 2. Authentication & Credential Security

### 2.1 Password Storage

- **Algorithm:** Passwords are never stored in plaintext. They are hashed using **Argon2id** (`@node-rs/argon2`) with memory-hard parameters configured to resist GPU and ASIC cracking attacks.
- **Verification:** Handled through constant-time verification routines to prevent timing side-channel attacks.
- **Password Rotation:** Enforces current-password verification (`changePasswordAction`), invalidates prior sessions, and records a security audit event (`PASSWORD_CHANGED`).

### 2.2 Session Lifecycle & Revocation

- **Storage:** Database-backed sessions stored in the `Session` table, indexed by a cryptographically secure random token.
- **Cookies:** Session cookies are set with `HttpOnly`, `SameSite=Lax` (or `Strict`), and `Secure` flags in production.
- **Instant Revocation:**
  - Logging out immediately deletes the database session record.
  - Role modifications (`changeUserRoleAction`) revoke all active sessions for that user.
  - College suspension or archiving (`changeCollegeStatus`) deletes all active sessions across the entire tenant.
  - Active session manager (`/account`) allows users to inspect and revoke individual remote sessions.

---

## 3. Rate Limiting & Denial-of-Service Defense

### 3.1 PostgreSQL Token-Bucket Limiter

CampusPulse incorporates an in-database atomic rate-limiting system (`src/server/auth/rate-limit.ts`) backed by `RateLimit` table records:

- **Atomicity:** Token consumption and window resets execute within atomic SQL queries (`UPDATE ... WHERE tokens >= 1`).
- **Fail-Closed Mode:** If the database rate-limiting query encounters an error, the limiter fails closed, throwing a 429 status rather than allowing unchecked abuse.
- **Dedicated Policies:**
  - `authAttempt`: Stricter thresholds for login, registration, and password reset endpoints.
  - `exportDownloadUser`: Enforces limits on CSV and data export generations.
  - `attendanceScanUser`: Dedicated rate limits on live QR camera scans.
  - `adminWriteUser`: Governs administrative actions, role updates, and tenant creation.

---

## 4. Cryptographic QR Attendance Security

### 4.1 Token Structure & Binding

The event attendance system is engineered to prevent ticket sharing, screenshot re-use, and unauthorized check-ins:

- **Registration Binding:** Attendance credentials are created for a specific `EventRegistration` ID and cannot be transferred.
- **Cryptographic Signature:** The token contains `registrationId`, `issuedAt`, and an HMAC-SHA256 signature calculated with server-side secrets.
- **Check-in Window Enforcement:** Check-in is permitted only during the active attendance window (2 hours before event start through 2 hours after event end).
- **Single Check-In Guarantee:** The database transaction enforces atomic state transition:
  ```sql
  UPDATE "EventRegistration" SET status = 'ATTENDED', "checkedInAt" = NOW()
  WHERE id = $1 AND status = 'CONFIRMED'
  ```
  If a duplicate QR scan arrives concurrently, only one transaction succeeds; subsequent scans are rejected as already checked in.

---

## 5. Poster Storage & File Upload Hardening

### 5.1 Verification Pipeline

- **MIME & Magic Bytes:** File headers are validated against binary magic signatures (JPEG, PNG, WebP) to prevent disguised executable uploads.
- **SVG Protection:** SVG files are strictly prohibited or stripped of `<script>` and foreignObject tags to eliminate stored XSS vectors.
- **S3 Presigned URLs:** Media is uploaded to private S3 buckets. Direct public write access is forbidden; uploads and reads use signed URLs or authenticated proxy routes (`/api/posters/[posterId]`).
- **Orphan Cleanup:** When an event poster is replaced, the unreferenced storage object is scheduled for deletion; if a transaction fails after file creation, a cleanup hook deletes the orphaned file.

---

## 6. Audit Logging & Compliance

- **Immutable Audit Trail:** The `AuditLog` table records actor ID, college ID, action type, entity type, entity ID, and structured JSON metadata.
- **Secret Redaction:** Passwords, API tokens, session cookies, and database connection strings are filtered and redacted before writing metadata.
- **Audit Consistency:** Audit records are written inside the same database transaction as the business operation (`runInTransaction`), guaranteeing that state changes and audit logs never desynchronize.
