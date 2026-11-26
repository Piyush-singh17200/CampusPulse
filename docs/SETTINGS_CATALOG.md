# CampusPulse — Comprehensive Settings Catalog

This catalog documents all configurable settings, tenant options, user preferences, security parameters, and operational flags across CampusPulse.

---

## 1. User & Account Settings (`/account`)

The unified settings center is available to all authenticated roles (`STUDENT`, `CLUB_ADMIN`, `COLLEGE_ADMIN`, `SUPER_ADMIN`).

| Setting Group     | Field / Feature      | Allowed Values                                                 | Storage                              | Description                                                                    |
| :---------------- | :------------------- | :------------------------------------------------------------- | :----------------------------------- | :----------------------------------------------------------------------------- |
| **Profile**       | Name                 | Read-only in settings (managed in `/student/profile` or admin) | `User.name`                          | Display name of the user.                                                      |
| **Profile**       | Email                | Read-only                                                      | `User.email`                         | Registered email address.                                                      |
| **Profile**       | College Tenant       | Read-only                                                      | `College.name`                       | Associated college campus.                                                     |
| **Profile**       | Role Badge           | Read-only                                                      | `User.role`                          | Current system role (`STUDENT`, `CLUB_ADMIN`, `COLLEGE_ADMIN`, `SUPER_ADMIN`). |
| **Security**      | Current Password     | Valid Argon2id string                                          | Transient verification               | Required to authorize a password change.                                       |
| **Security**      | New Password         | Min 8 chars, 1 uppercase, 1 lowercase, 1 number                | `Account.password`                   | Argon2id-hashed credential replacement.                                        |
| **Security**      | Active Sessions      | List of active tokens                                          | `Session` table                      | Displays device type (Desktop/Mobile), creation, and expiration dates.         |
| **Security**      | Session Revocation   | Action per session                                             | `Session.delete`                     | Revokes individual remote browser sessions immediately.                        |
| **Appearance**    | Theme Preference     | `system`, `light`, `dark`                                      | `localStorage` (`campuspulse-theme`) | Controls the visual theme across public and dashboard screens.                 |
| **Notifications** | System Announcements | `true` / `false`                                               | `NotificationPreference`             | Platform-wide maintenance and policy alerts (always enforced).                 |
| **Notifications** | Event Reminders      | `true` / `false`                                               | `NotificationPreference`             | Reminders 24h and 2h before registered events begin.                           |
| **Notifications** | Registration Updates | `true` / `false`                                               | `NotificationPreference`             | Confirmation, waitlist promotions, and capacity alerts.                        |
| **Notifications** | Attendance Updates   | `true` / `false`                                               | `NotificationPreference`             | Check-in confirmations, QR issuance, and attendance corrections.               |
| **Notifications** | Feedback Updates     | `true` / `false`                                               | `NotificationPreference`             | Post-event feedback requests and review confirmations.                         |
| **Notifications** | Moderation Updates   | `true` / `false`                                               | `NotificationPreference`             | Approval, rejection, and resubmission requests for club events.                |
| **Notifications** | Club Updates         | `true` / `false`                                               | `NotificationPreference`             | Announcements from followed campus student organizations.                      |

---

## 2. Student Profile Settings (`/student/profile`)

Configured exclusively by students within their active college tenant.

| Field             | Allowed Values                             | Validation              | Description                                              |
| :---------------- | :----------------------------------------- | :---------------------- | :------------------------------------------------------- |
| **Roll Number**   | String, max 48 chars                       | Optional, alphanumeric  | Student university identification number.                |
| **Department**    | String, max 80 chars                       | Optional, text          | Academic department / faculty (e.g. "Computer Science"). |
| **Academic Year** | `1`, `2`, `3`, `4`, `5`, `ALUMNI`, `OTHER` | Enum                    | Current year of study.                                   |
| **Bio**           | String, max 500 chars                      | Optional text           | Short public introduction.                               |
| **Interests**     | Multi-select IDs                           | Active system interests | Powers personalized recommendation engine scoring.       |

---

## 3. Club Organization Settings (`/club/settings`)

Managed by active Club Presidents and Officers.

| Field             | Allowed Values         | Validation                  | Description                                           |
| :---------------- | :--------------------- | :-------------------------- | :---------------------------------------------------- |
| **Club Name**     | String, 2 to 120 chars | Required, unique in college | Public name of the club.                              |
| **Description**   | String, max 1000 chars | Optional text               | Club mission, meeting times, and orientation details. |
| **Contact Email** | Valid email            | Optional                    | Public inquiries email address.                       |
| **Slug**          | String, 2 to 60 chars  | Lowercase alphanumeric      | URL slug for public club directory (`/clubs/[slug]`). |

---

## 4. College Tenant Settings (`/college/settings`)

Managed by College Administrators for their specific college tenant.

| Field              | Allowed Values         | Validation                     | Description                                                  |
| :----------------- | :--------------------- | :----------------------------- | :----------------------------------------------------------- |
| **College Name**   | String, 2 to 160 chars | Required                       | Official name (e.g. "Lovely Professional University").       |
| **Short Name**     | String, max 48 chars   | Optional                       | Campus abbreviation (e.g. "LPU"). Used in UI headers.        |
| **Timezone**       | Valid IANA Timezone    | Required (e.g. `Asia/Kolkata`) | Governs event date ranges, check-in countdowns, and exports. |
| **Primary Domain** | Domain string          | Optional                       | Email domain for auto-matching student registrations.        |

---

## 5. Platform Tenant Provisioning & Governance (`/platform/settings`, `/platform/colleges`)

Managed by Platform Administrators (`SUPER_ADMIN`).

| Control                      | Scope    | Allowed Actions                                         | Side Effects                                                            |
| :--------------------------- | :------- | :------------------------------------------------------ | :---------------------------------------------------------------------- |
| **Provision College Tenant** | Global   | Create name, slug, shortName, domain, timezone          | Inserts `College`, records `COLLEGE_CREATED` audit log.                 |
| **College Lifecycle Status** | Tenant   | `ACTIVE`, `SUSPENDED`, `ARCHIVED`                       | Changing from `ACTIVE` immediately revokes all user sessions in tenant. |
| **User Role Assignment**     | Platform | `STUDENT`, `CLUB_ADMIN`, `COLLEGE_ADMIN`, `SUPER_ADMIN` | Revokes target user's active sessions immediately.                      |
| **User Account Status**      | Platform | `ACTIVE`, `SUSPENDED`, `DEACTIVATED`                    | Blocks subsequent requests in `assertActorActive`.                      |

---

## 6. Environment & Infrastructure Settings

| Variable               | Environment        | Required | Description                                                        |
| :--------------------- | :----------------- | :------: | :----------------------------------------------------------------- |
| `DATABASE_URL`         | Neon PostgreSQL 17 |   Yes    | Pooled connection string with SSL mode `require`.                  |
| `DIRECT_URL`           | Neon PostgreSQL 17 |   Yes    | Direct connection string for Prisma migrations.                    |
| `BETTER_AUTH_SECRET`   | Auth runtime       |   Yes    | 32+ character high-entropy secret for cookie HMAC/encryption.      |
| `BETTER_AUTH_URL`      | Auth runtime       |   Yes    | Base canonical URL (e.g. `https://campuspulse.vercel.app`).        |
| `NEXT_PUBLIC_APP_URL`  | Browser runtime    |   Yes    | Client-facing canonical URL for links and social metadata.         |
| `S3_ENDPOINT`          | Supabase Storage   | Optional | S3-compatible endpoint URL for poster storage.                     |
| `S3_REGION`            | Supabase Storage   | Optional | S3 region (default `auto` or `us-east-1`).                         |
| `S3_BUCKET`            | Supabase Storage   | Optional | S3 bucket name (e.g. `event-posters`).                             |
| `S3_ACCESS_KEY_ID`     | Supabase Storage   | Optional | S3 access key credential.                                          |
| `S3_SECRET_ACCESS_KEY` | Supabase Storage   | Optional | S3 secret access key credential.                                   |
| `RATE_LIMIT_ENABLED`   | App runtime        |   Yes    | `true` to enforce PostgreSQL token-bucket rate limits.             |
| `EMAIL_ENABLED`        | App runtime        | Optional | `true` when SMTP credentials are configured; `false` in tests/dev. |
