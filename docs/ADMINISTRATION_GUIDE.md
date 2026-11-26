# CampusPulse — Technical Administration & Operations Manual

This manual provides authoritative operating procedures for systems engineers, campus IT administrators, and platform operators managing CampusPulse deployments.

---

## 1. Initial Deployment & First-Run Bootstrap

### 1.1 First Tenant Creation

Before any user can register through the public web interface, at least one active College tenant must exist in the database.

Execute the explicit bootstrap script from the repository root:

```powershell
npm run college:bootstrap -- `
  --confirm-college-bootstrap `
  --name "Lovely Professional University" `
  --slug "lpu" `
  --short-name "LPU" `
  --domain "lpu.in" `
  --timezone "Asia/Kolkata"
```

**Safety Invariants:**

- Requires `--confirm-college-bootstrap`.
- Rejects duplicate slugs or primary email domains.
- Validates IANA timezone against Node.js runtime.
- Never creates user accounts or password hashes.

### 1.2 Initial Super Admin Candidate Registration

1. Start or visit the deployed web application at `https://campuspulse.vercel.app` (or `http://localhost:3000`).
2. Navigate to `/register`.
3. Select the bootstrapped college tenant.
4. Complete the registration form with your administrative email and a strong password.

### 1.3 Promoting Candidate to Super Admin

Execute the operator promotion script targeting the registered email:

```powershell
npm run auth:bootstrap-super-admin -- `
  operator-email@domain.com `
  --confirm-super-admin-bootstrap
```

**What the Bootstrap Script Does:**

- Verifies the user exists, is `ACTIVE`, and is not soft-deleted.
- Atomically updates `User.role` to `SUPER_ADMIN` and clears `collegeId` (Super Admins are platform-wide).
- Revokes all existing sessions in the `Session` table.
- Inserts an immutable `USER_ROLE_CHANGED` audit record in `AuditLog`.

---

## 2. Platform Tenant Provisioning (`/platform/colleges`)

Subsequent colleges do not require CLI execution. Authenticated Super Admins can provision colleges directly via the web UI:

1. Open the Platform Dashboard and select **Colleges**.
2. Click **Create college** to open the creation dialog.
3. Supply:
   - **Name:** Full university title.
   - **Slug:** URL-friendly lowercase identifier.
   - **Short Name:** Abbreviation (displayed in badges and mobile navigation).
   - **Primary Domain:** Student email domain for automated validation.
   - **Timezone:** IANA timezone string (e.g. `America/New_York`, `Asia/Kolkata`).
4. Click **Create college**. The system records a `COLLEGE_CREATED` audit event and makes the tenant available immediately for student registrations.

---

## 3. User Governance & Role Management

### 3.1 Delegating Roles

- **College Admins (`COLLEGE_ADMIN`):** Appointed by Super Admins via `/platform/users` or fellow College Admins via `/college/users`. College Admins can only manage users within their own college.
- **Club Admins (`CLUB_ADMIN`):** Assigned when a student is granted `PRESIDENT` or `OFFICER` membership in a registered club.
- **Role Invalidation Rule:** Changing any user's role immediately purges all active session rows from the database. The user must re-authenticate to obtain a JWT/session with their updated claims.

### 3.2 Account Suspension & Reactivation

- Users violating conduct policies can be placed in `SUSPENDED` status.
- `assertActorActive` rejects suspended users on the very next HTTP request, even if their session cookie is valid.

---

## 4. Audit Log Governance & Compliance

CampusPulse maintains an immutable audit trail (`AuditLog`) for every critical action:

- `USER_ROLE_CHANGED`
- `USER_STATUS_CHANGED`
- `COLLEGE_CREATED` / `COLLEGE_UPDATED`
- `CLUB_APPROVED` / `CLUB_REJECTED`
- `EVENT_APPROVED` / `EVENT_REJECTED` / `EVENT_CANCELLED`
- `ATTENDANCE_RECORDED` / `ATTENDANCE_CORRECTED`
- `EXPORT_DOWNLOADED`

### 4.1 Audit Log Export

- College Admins can inspect and filter college-scoped audit history at `/college/audit-logs`.
- Super Admins can inspect the global audit stream at `/platform/audit-logs`.
- Exporting audit records is governed by strict rate limits and is itself logged as an `EXPORT_DOWNLOADED` audit action.

---

## 5. Routine Database Maintenance

### 5.1 Pruning Expired Rate Limits

Execute the pruning script periodically (recommended: weekly cron):

```bash
npm run db:prune-rate-limits
```

This removes expired rows from the `RateLimit` table, keeping the PostgreSQL storage footprint minimal.
