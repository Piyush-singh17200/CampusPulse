# CampusPulse Project Demo Script

**Format:** 10–12 minute live walkthrough, with a 5-minute fallback  
**Audience:** evaluator, instructor, or project owner  
**Demo status:** local database, built production server or `next dev`  
**Required line:** “CampusPulse — Too Many Posters, Too Little Signal.”

## Before the demo

- [ ] Docker Desktop is running and `campuspulse-postgres` is healthy.
- [ ] `npm run db:health` passes.
- [ ] The app is running at `http://localhost:3000`.
- [ ] The four demo accounts are available with password `CampusPulse!2026`.
- [ ] Browser zoom is 100%, window is about 1440 px wide.
- [ ] Close personal tabs and notifications.
- [ ] Keep the Production Release screenshot folder open as a fallback.
- [ ] Do not open DevTools, `.env.local`, secrets, or production dashboards.

## The 10-minute sequence

### 0:00–1:15 — Landing page: the problem and the product

**Open:** `http://localhost:3000`

Say:

> CampusPulse is a campus event platform built around one problem: too many posters, too little signal. Students miss events that fit them, clubs repeat manual work, colleges cannot see decisions clearly, and platform administrators lack an accountable network view.

Point to the headline, then the four role tabs in the product preview.

> This preview is illustrative. The signed-in workspaces are live and database-backed. The platform has four connected roles, not four disconnected demos.

Click each role tab once, then click **Find your next event** to enter the student flow.

### 1:15–3:15 — Student journey

**Sign in as:** `isha.rao@campuspulse.example`

Say:

> The student dashboard is built around the next decision, not a wall of cards. The next registered event is first, followed by the next few things on the student's radar.

Point out:

- **Upcoming**, **Registered**, **Attended**, and **Saved** counts.
- **Your interests** and **Picked for you**.
- **Latest notifications** with a single unread item.

Open **Discover events**.

> Discovery only shows published events from active clubs. Filters, dates, and categories are server-backed.

Open the first event.

> This event has no uploaded poster, so the designed fallback keeps the page credible instead of showing a broken image.

Point out the confirmed registration, **Open attendance QR**, and **Cancel registration**. Do not cancel during the live demo unless you have a backup registration.

Open **Calendar**.

> The calendar is the student's registered schedule in college time. The `.ics` download is authenticated, tenant-scoped, and capped at 1,000 events.

Optionally open **Notifications** and point to the read/unread states.

### 3:15–5:30 — Club operations

**Sign in as:** `robotics.president@campuspulse.example`

Say:

> The club workspace is scoped to the clubs this user actually manages. It is not a generic admin panel.

Point out:

- **Operations focus**: one event waiting for review and one draft to finish.
- **Next published event**: Build Night.
- **Upcoming**, **Drafts**, **Pending**, and **Registrations** metrics.

Open **Events**.

> Every event moves through a real lifecycle: draft, submit, college review, publish, cancel, or complete. The server rechecks permissions and transitions.

Open **Attendance**.

> Attendance is a QR-first flow with a manual fallback. Corrections require a reason and are audited.

Open **Analytics**.

> These are database-derived engagement numbers: registrations, attendance, ratings, and category mix. No mock analytics service.

If asked about OCR:

> Poster OCR runs locally, only on explicit request, with a 2-active / 8-queued / 20-second guard. OCR suggestions are never auto-applied; a human accepts each field.

### 5:30–7:30 — College governance

**Sign in as:** `northfield.admin@campuspulse.example`

Say:

> The college workspace is where the institution exercises control without taking over club operations.

Point out:

- **Approval queue**: one event submission.
- **Club applications**: none waiting in this fixture.
- **Clubs**, **Pending clubs**, and **Events** metrics.

Open **Approvals**.

> Approving or rejecting requires a reason. The decision writes an audit record and a notification in one transaction. Duplicate suggestions are advisory; confirming or dismissing one never merges or deletes an event automatically.

Open **Analytics** and then **Audit history**.

> College administrators see their own college only. The audit trail is paginated and redacted; it is not a raw database dump.

Optional: open **Users** and point out that role changes are constrained and revoke sessions.

### 7:30–9:15 — Platform accountability

**Sign in as:** `platform.admin@campuspulse.example`

Say:

> The platform workspace is intentionally narrow. It sees the network and governs tenants; it does not impersonate users or read private content.

Point out:

- **Tenant coverage**, **Content pipeline**, and **Governance trail**.
- College, user, club, event, and registration totals.
- **Network health** and the latest colleges.

Open **Audit history**.

> This is the cross-tenant governance record: event approvals, exports, attendance corrections, poster changes, and role changes.

Open **Settings**.

> The settings page deliberately exposes only safe operational signals: email delivery is not configured locally, storage is local, and the database is connected. No secrets or connection strings are rendered.

### 9:15–10:30 — Responsive and accessibility close

Resize the browser to **390 px** (or use device emulation).

> The four workspaces collapse to the same navigation model. The mobile drawer traps focus, closes on Escape, locks background scroll, and returns focus to the menu button. Reduced-motion preferences are respected.

Open the menu, navigate to one item, and close it.

Close with:

> CampusPulse is submission-ready locally: all four roles are connected to one PostgreSQL record, permissions are server-verified, the critical journeys are tested, and the remaining gaps are production operations rather than product theatre. The full status is **SUBMISSION READY WITH LIMITATIONS**, documented in the final verification report.

## Five-minute fallback

1. Landing page and role preview — 45 seconds.
2. Student overview and event detail — 60 seconds.
3. Club overview and attendance — 60 seconds.
4. College approvals and audit — 60 seconds.
5. Platform overview and settings — 45 seconds.
6. Responsive close — 30 seconds.

## Backup plan

If the live app fails:

- Open `docs/screenshots/showcase/01-landing-hero-1440.png` through `20-platform-settings-1440.png`.
- Use `docs/screenshots/showcase/capture-report.json` for the route audit.
- Use `docs/FEATURE_MATRIX.md` for the capability inventory.
- State plainly that the local demo database or server is unavailable, rather than claiming a production deployment.

## Questions and honest answers

**“Is this deployed?”**  
No. It is locally runnable and production-shaped, but no live deployment or DNS/TLS work was performed.

**“Does email work?”**  
The SMTP password-reset path is implemented and tested at the application layer. Live delivery is not configured in this environment.

**“Does S3 work?”**  
The S3-compatible adapter is implemented. The verified local path uses the filesystem adapter. Live S3 credentials and bucket policy were not exercised.

**“Is it secure?”**  
Server-side sessions, tenant-scoped queries, RBAC, CSRF/origin checks, rate limits, password hashing, audit logging, and upload validation are implemented and tested. This is not a penetration test, and PostgreSQL RLS is not enabled.

**“Why are names marked Demo?”**  
Every person, club, college, and event is fictional. The label prevents the fixture from being mistaken for real traction or real institutional data.

## Do not say

- “We have real users / real colleges / real event attendance.”
- “This is live in production.”
- “Email and S3 are fully verified.”
- “The system is penetration-tested.”
- “All tests, including the full browser suite, were rerun in the main repository.”
