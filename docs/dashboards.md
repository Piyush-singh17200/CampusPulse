# Role dashboards, routes, and Server Actions

Prompt 5 implements four authenticated, role-specific CampusPulse dashboards.
Prompt 6 extends them with event poster management, authenticated poster
delivery, and transactional in-app notifications. Prompt 7 adds local poster
OCR review, student recommendations, advisory duplicate review, and schedule-
conflict warnings. Prompt 8 adds QR attendance, student/club/college feedback,
authenticated ICS downloads, authorized CSV exports, engagement analytics, and
notification filters/preferences. Every page reads real PostgreSQL data through
server-only query functions and every mutation goes through a Server Action or
an authenticated download route backed by an existing domain service. No
dashboard exposes Prisma to client components and no public business API was
added. See `docs/event-intelligence.md` and
`docs/attendance-feedback-analytics.md` for feature details and limitations.

## 1. Access model

All dashboard layouts call `requireDashboardRole(role)` from
`src/server/auth/page-guard.ts`. That helper:

- resolves the current Better Auth session and reloads the trusted user;
- redirects unauthenticated users to `/login` or `/account-disabled`;
- redirects a signed-in user who opens the wrong role workspace to their own
  dashboard;
- redirects users without a college out of tenant dashboards.

A layout guard is not the authorization boundary. Every page independently calls
its role-scoped query function, and those functions call the assertions in
`src/server/dashboards/access.ts` again. Every mutation calls a service that
reloads authorization state from PostgreSQL.

| Role            | Workspace   | Scope                                                             |
| --------------- | ----------- | ----------------------------------------------------------------- |
| `STUDENT`       | `/student`  | Own college's published events, own registrations, saves, profile |
| `CLUB_ADMIN`    | `/club`     | Active president/officer clubs in the actor's college             |
| `COLLEGE_ADMIN` | `/college`  | The actor's own college only                                      |
| `SUPER_ADMIN`   | `/platform` | Platform-wide administration across colleges                      |

Browser-supplied `userId`, role, college, and membership values are never
trusted. A browser may submit an object identifier such as an event, club, user,
or registration ID; the receiving service validates it and scopes it to the
trusted actor. Cross-tenant object IDs return safe not-found-style errors or
`null` from read queries.

Club administrators with more than one managed club select the active club with
`?club=<clubId>`. The query layer verifies the requested club against the
actor's active president/officer memberships and throws a tenant-isolation error
for any other club.

## 2. Route map

### Student

| Route                       | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `/student`                  | Overview, upcoming events, recommendations, counts  |
| `/student/discover`         | Search, category/date filters, pagination, saves    |
| `/student/events/[eventId]` | Event detail, poster, registration and save actions |
| `/student/registrations`    | Upcoming and past registrations with cancellation   |
| `/student/saved`            | Persistent saved-event shortlist                    |
| `/student/calendar`         | Registrations grouped by date, with ICS downloads   |
| `/student/notifications`    | Filtered notifications, read state, and preferences |
| `/student/feedback`         | Submit or edit feedback for attended events         |
| `/student/profile`          | Name, academic fields, bio, and interests           |

### Club administrator

| Route                         | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `/club`                       | Club overview, event counts, recent activity          |
| `/club/events`                | Club event list with status filter                    |
| `/club/events/create`         | Create a draft event                                  |
| `/club/events/[eventId]`      | Event detail, lifecycle actions, registration summary |
| `/club/events/[eventId]/edit` | Edit an editable event and manage its poster          |
| `/club/registrations`         | Registrations for a selected club event               |
| `/club/attendance`            | QR/manual check-in, corrections, and attendance CSV   |
| `/club/feedback`              | Read-only feedback review for completed events        |
| `/club/analytics`             | Engagement metrics, filters, trends, and CSV export   |
| `/club/settings`              | Edit the active club profile                          |

### College administrator

| Route                       | Purpose                                          |
| --------------------------- | ------------------------------------------------ |
| `/college`                  | College overview, moderation queue, recent audit |
| `/college/events`           | All events in the college with status filter     |
| `/college/events/[eventId]` | Event moderation detail                          |
| `/college/approvals`        | Pending event and club approvals                 |
| `/college/clubs`            | Clubs in the college with status filter          |
| `/college/clubs/[clubId]`   | Club detail, memberships, events                 |
| `/college/users`            | Searchable, filterable, paginated college users  |
| `/college/feedback`         | Review and moderate feedback across the college  |
| `/college/analytics`        | Engagement analytics, filters, and CSV export    |
| `/college/audit-logs`       | Paginated, action-filtered college audit history |
| `/college/settings`         | College name, short name, and IANA timezone      |

### Platform administrator

| Route                            | Purpose                                             |
| -------------------------------- | --------------------------------------------------- |
| `/platform`                      | Platform overview and recent cross-college activity |
| `/platform/colleges`             | Searchable, filterable, paginated college list      |
| `/platform/colleges/[collegeId]` | College detail, users, clubs, audit, lifecycle      |
| `/platform/users`                | Platform-wide user search and filters               |
| `/platform/analytics`            | Cross-college engagement analytics and CSV export   |
| `/platform/audit-logs`           | Platform-wide audit history with action filter      |
| `/platform/settings`             | Read-only platform configuration summary            |

Each workspace has a role-specific layout plus `loading.tsx` and `error.tsx`
states. Empty states are rendered per section rather than as fake sample data.
Prompt 8 adds route-level loading/error states for attendance, feedback, and
notifications; error boundaries show a generic message and an optional digest,
never raw server error text.

Authenticated download routes are separate from the page tree:

| Route                                 | Scope                                         |
| ------------------------------------- | --------------------------------------------- |
| `GET /api/calendar/events/[eventId]`  | One published/completed same-college event    |
| `GET /api/calendar/registered`        | The student's confirmed/attended events       |
| `GET /api/calendar/saved`             | The student's published saved events          |
| `GET /api/exports/club/attendance`    | One managed-club event's attendance register  |
| `GET /api/exports/club/analytics`     | Managed-club analytics for the active filters |
| `GET /api/exports/college/analytics`  | College analytics for the active filters      |
| `GET /api/exports/platform/analytics` | Platform analytics for the active filters     |

Each handler resolves the current session, calls the same server-only query or
service path as the page, and returns a private, non-cacheable attachment.
Unauthenticated requests return `401`; unauthorized or cross-tenant objects
return a safe `403`/`404` without tenant data.

## 3. Server-only data layer

`src/server/dashboards/queries.ts` is marked `server-only` and contains the
dashboard read model. Query functions:

- accept the trusted `AuthenticatedActor` as their first argument;
- assert the required dashboard role and college or club scope;
- select only the fields the dashboard renders;
- scope every query by `collegeId` and, for club views, the verified `clubId`;
- return `null` for missing or cross-tenant object lookups where the page can
  render a non-enumerating not-found state;
- use database counts, groups, filters, ordering, and pagination rather than
  hard-coded metrics.

`src/server/dashboards/access.ts` contains the role, managed-club, college-scope,
and club-manager assertions shared by queries and Server Actions.
`src/server/dashboards/engagement-analytics.ts` and `feedback.ts` contain the
Prompt 8 server-only aggregates and feedback read models;
`src/lib/analytics-query.ts` normalizes date/event/club/category/status filters
before they reach Prisma.

## 4. Server Actions

`src/features/dashboards/actions.ts` contains all dashboard mutations. Every
action follows the same sequence:

1. Call `assertSameOrigin()` for CSRF/origin protection.
2. Call `requireAuthenticatedUser()` to load the current trusted actor.
3. Convert `FormData` into service input; never read identity or authorization
   fields from the form.
4. Invoke an existing domain service. The service validates with Zod, reloads
   authorization state, performs the transaction, writes an audit event, and
   returns safe domain errors.
5. Revalidate affected routes. Event creation redirects to the new event.
6. Return a safe action state. Known `DomainError` messages are shown; unexpected
   errors are logged by name and replaced with a generic message.

Implemented actions:

- Student: save/unsave event, register/cancel registration, mark one/all
  notifications read, update notification preferences, submit/edit feedback,
  update profile.
- Club: create draft (with optional poster), update event, transition event,
  upload/replace/remove poster, update club profile, scan/manual check-in,
  correct attendance with a reason.
- College: approve/reject club, change user role/status, moderate feedback,
  update college settings.
- Platform: change college status.

Poster actions validate the uploaded bytes on the server and call
`uploadEventPoster`/`removeEventPoster`. The actions never accept a storage path
or an actor identity from the browser. Event creation uploads the optional
poster only after the draft has been created; a poster failure leaves the draft
intact and redirects to the edit page with a safe error.

There is no dashboard route that accepts a browser-supplied actor identity,
role, college, or club membership. There is no public business API.

## 5. Saved events

Saved events are persisted in PostgreSQL rather than browser storage.

- `SavedEvent` has `collegeId`, `studentProfileId`, and `eventId`.
- Composite foreign keys keep the student profile, event, and save in the same
  college.
- `@@unique([studentProfileId, eventId])` makes saving idempotent.
- Saving verifies that the event is published, not deleted, and belongs to an
  active club in the student's college.
- Unsaving is a no-op when the row is already absent.
- Both save and unsave write `SAVED_EVENT_CHANGED` audit entries inside the
  transaction.

## 6. Posters and notifications

### Poster management

- Poster management is available on `/club/events/[eventId]/edit` for active
  owning-club presidents/officers.
- Upload/replace/remove is allowed for `DRAFT`, `REJECTED`, and `PUBLISHED`
  events. It is locked for `PENDING_APPROVAL`, `CANCELLED`, and `COMPLETED`.
- JPEG, PNG, and WebP are accepted up to 5 MB, with server-side content
  validation and dimension limits. Browser MIME type and filename are not
  trusted.
- Replacement generates a new asset URL and removes the previous file after
  commit only when no poster row still references it.
- `PosterField` shows a local preview during creation; `PosterManager` shows the
  current poster, replacement preview, alt text, and remove action.
- `PosterImage` provides a safe fallback when a poster is absent or fails to
  load.
- Posters are served by `GET /api/posters/[posterId]`, not from `public/`.
  Unauthenticated requests return `401`; unauthorized or missing posters return
  `404`. See `docs/poster-storage.md` for the access matrix and headers.

### Notifications

- Event approval and rejection notify active presidents/officers of the owning
  club.
- Event cancellation notifies students whose registrations were `CONFIRMED` and
  cancels those registrations in the same transaction.
- Registration confirmation and cancellation notify the student.
- Notifications are written in the same transaction as the state change. A
  failed or stale transition cannot leave an orphan notification.
- Repeated retries do not create duplicates because transitions are guarded by
  the current state. There is no dedupe column or outbox table.
- The dashboard notification page reads, filters, paginates, and marks existing
  notification rows as read. Per-user preferences suppress optional in-app
  registration, attendance, and feedback notifications at insert time;
  moderation notifications remain transactional and are not user-suppressible.
  Email/push/SMS delivery is not configured.

## 7. Attendance, feedback, analytics, and exports

### Attendance

- `/club/attendance` limits the event selector to non-deleted `PUBLISHED` and
  `COMPLETED` events in the selected managed club.
- The page shows registered, present, pending, no-show, and attendance
  percentage metrics. The denominator excludes cancelled registrations.
- The camera scanner uses `BarcodeDetector` when the browser supports it. The
  manual code field accepts the full CampusPulse payload or a bare token and is
  the fallback for unsupported cameras, denied permission, or desktop use.
- A successful scan is server-authoritative: `scanAttendance` rechecks the
  token hash, event, club, registration, expiry, and status before writing
  `ATTENDED` and `checkedInAt`.
- Manual corrections require `ATTENDED` or `NO_SHOW` plus a 3–500 character
  reason. Corrections revoke outstanding credentials and write audit metadata
  with the previous status, new status, reason, and `method: "MANUAL"`.
- The register supports name/roll/department search, status filters, and
  check-in timestamps. `Export attendance CSV` downloads the selected event.

### Feedback

- `/student/feedback` is limited to the student's `ATTENDED` registrations for
  `COMPLETED` events within 30 days of completion.
- Students submit one whole-number rating from 1 to 5 and an optional comment
  up to 2,000 characters. They can edit while the window remains open.
- `/club/feedback` is read-only for club managers and supports event, rating,
  and visibility filters with 20-row pagination. Club managers can see hidden
  responses and reasons but cannot moderate them.
- `/college/feedback` supports event, club, rating, and visibility filters and
  exposes hide/restore actions to college administrators. Moderation requires a
  reason and preserves the original response and audit history.
- Averages and distributions use `VISIBLE` feedback only.

### Calendar downloads

- The three ICS routes are authenticated, download-only exports. There is no
  two-way synchronization, subscription feed, or reminder delivery.
- Single-event downloads include same-college `PUBLISHED` and `COMPLETED`
  events. Draft, pending, rejected, cancelled, deleted, and cross-college events
  are excluded.
- Registered downloads include the student's `CONFIRMED` and `ATTENDED`
  registrations. Saved downloads include currently published saved events.
- Files use RFC 5545 escaping, UTC timestamps, the college IANA timezone, stable
  opaque UIDs, and bounded event counts. Responses are private and non-cacheable.

### Analytics and CSV exports

- Club, college, and platform pages accept validated date ranges and the
  role-appropriate event, club, category, and status filters.
- Metrics include event status counts, registrations, active/cancelled counts,
  present/no-show, attendance rate, completion rate, visible average rating,
  feedback response count, rating distribution, trends, category/club mixes,
  most-attended events, and low-attendance events.
- All values come from PostgreSQL aggregates. Empty ranges render explanatory
  empty states rather than sample data.
- The four CSV routes reuse the page authorization and filter normalization.
  Club attendance includes every registration row for the selected event.
  Analytics exports include the event breakdown or platform summary.
- CSV output is UTF-8 with a BOM, CRLF records, and apostrophe protection for
  cells that could be interpreted as spreadsheet formulas. Responses are
  private, non-cacheable attachments with `nosniff`.

## 8. Event intelligence surfaces

### Club OCR review

- `/club/events/[eventId]/edit` renders `PosterOcrPanel` for draft or rejected
  events with a primary poster.
- The panel shows OCR status, a safe failure message, extracted values, evidence,
  confidence when defensible, and per-field Accept/Reject/Pending decisions.
- Accepted values are editable before saving. Applying a review calls the normal
  event update service and keeps the event in `DRAFT`/`REJECTED`.
- The page remains fully usable without OCR; manual event creation is never
  blocked by an OCR failure or pending worker.

### Student recommendations and conflicts

- The student overview shows deterministic recommendations with a single
  honest explanation under each event card. If recommendations are unavailable
  or empty, it falls back to recent events and a neutral explanation.
- The student event detail page shows advisory schedule conflicts before
  registration. The registrations list marks rows that overlap another active
  registration.
- Registration still succeeds when a conflict is advisory; the confirmation
  message includes the warning and says the place is reserved.

### College duplicate review

- `/college/approvals` includes a duplicate-suggestion section and a pending
  count. Pending event rows show a duplicate-flag badge when suggestions exist.
- `/college/events/[eventId]` shows duplicate suggestions involving that event.
- `DuplicateReviewCard` displays both events, confidence, reasons, and
  Confirm/Dismiss actions. The UI states that review never merges, rejects,
  cancels, or deletes either event.

## 9. UI and responsive behavior

`src/components/dashboard/dashboard-shell.tsx` provides a shared application
shell with role-specific navigation, workspace identity, user identity, sign-out,
a skip link, and a mobile drawer. The four layouts use different tones while
sharing the existing design tokens and primitives.

Shared dashboard primitives include page headers, section cards, metric cards,
accessible bar lists (with screen-reader table fallbacks), status badges, event
cards, inline metadata, and action/reason/select forms. Analytics are rendered
with dependency-free SVG bars backed by real grouped counts, not a charting
library. SVG presentation attributes are used instead of inline `style`
attributes so the production nonce-based CSP can keep `'unsafe-inline'`
disabled; the only `style-src-attr` allowances are narrow hashes for
framework-owned inline styles emitted by Next.js and `next/image`.

The dashboard routes are designed for 360, 390, 768, 1024, 1280, and 1440 pixel
widths. Tables scroll horizontally only where a wide audit view needs it; the
primary dashboard content stacks on narrow screens. Loading, empty, error, and
not-found states are implemented per workspace.

## 10. Tests

Dashboard and event-operation test coverage includes:

- role and dashboard access assertions;
- active club-manager membership checks;
- college-scope and club-manager assertions;
- student context, discovery filters, pagination, event detail, dashboard counts,
  registrations, saved events, calendar, and notifications;
- club workspace selection, cross-club rejection, counts, events, registrations,
  attendance, analytics, and settings;
- college counts, approval queues, clubs, users, audit pagination/filtering,
  event lookup, analytics, and settings;
- platform counts, college/user/audit filters, pagination, analytics, and
  settings;
- saved-event idempotency, duplicate unsave, cross-tenant rejection, invalid
  input, and audit;
- student profile updates, interest validation, notification read rules, and
  attendance transitions;
- club profile, college settings, college lifecycle, user status, session
  revocation, and unauthorized mutation paths;
- poster validation, storage keys/path traversal, upload/replacement/removal,
  access control, storage failure, and database rollback cleanup;
- approval/rejection/cancellation/registration notification scoping and retry
  guards;
- Playwright create → preview → submit → approve → student view → register →
  club registration list → cancel → replace → access-control checks → remove →
  responsive layouts;
- Prompt 7 OCR extraction and review, OCR claim/failure safety, recommendation
  eligibility and explanations, duplicate scoring/review and the submission
  hook, schedule-overlap detection, registration revalidation, and audit
  metadata;
- Prompt 7 Playwright OCR review, recommendations, duplicate review, conflict
  warnings, and responsive layouts;
- Prompt 8 attendance window/credential/scan/correction authorization and audit,
  feedback eligibility/submission/edit/moderation, ICS escaping and scoped
  downloads, CSV BOM/CRLF/formula protection, analytics filters and aggregates,
  notification filters/pagination/preferences, and read state;
- Prompt 8 Playwright attendance, feedback, ICS/CSV downloads, analytics,
  notifications, authorization checks, and responsive layouts.

All tests run against the isolated `campuspulse_test` database. The dashboard,
Prompt 6, Prompt 7, and Prompt 8 migrations are applied by the test global setup
through `prisma migrate deploy`. The full suite was verified with 28 test files /
215 tests passing.

## 11. Visual verification

Desktop and mobile overview screenshots for all four workspaces are stored in
`docs/screenshots/prompt-5/`:

- `student-desktop.png` and `student-mobile.png`;
- `club-desktop.png` and `club-mobile.png`;
- `college-desktop.png` and `college-mobile.png`;
- `platform-desktop.png` and `platform-mobile.png`.

Prompt 6 workflow screenshots are stored in `docs/screenshots/prompt-6/` and
cover the club create preview, draft poster, college approval, student event,
registration, club registration list, cancellation notification, replacement,
removal fallback, and student event detail at 360, 390, 768, 1024, 1280, and
1440 pixel widths.

Prompt 7 workflow screenshots are stored in `docs/screenshots/prompt-7/` and
cover the OCR review panel, student recommendations, college duplicate review,
schedule-conflict warning, and responsive layouts at 360, 390, 768, 1024, 1280,
and 1440 pixel widths.

Prompt 8 screenshots are stored in `docs/screenshots/prompt-8/` and cover the
club attendance register, student/club/college feedback, club/college/platform
analytics, and student notifications at 1440 px plus attendance and
notifications at 390 px.

The final browser pass exercised 360, 390, 768, 1024, 1280, and 1440 pixel
widths. Every role had zero horizontal overflow, the mobile navigation drawer
opened with all role links and closed with Escape, and all four workspaces had
zero console or page errors.

## 12. Known limitations

- Tenant isolation remains application-layer scoping plus composite foreign
  keys; PostgreSQL RLS is not implemented.
- Cross-tenant dynamic detail URLs render the branded 404 page and expose no
  tenant data. Because the dashboard loading shell has already streamed, the
  browser response status can remain 200 instead of 404; this is a Next.js
  streaming behavior, not an authorization bypass.
- Notification delivery is in-app only. Email/push/SMS and a background outbox
  are not configured; the dashboard reads and marks existing rows as read.
- Poster storage uses the local filesystem adapter. It is not shared across
  instances, CDN-backed, or malware-scanned. See `docs/poster-storage.md`.
- OCR is English-only, request-bound, and has no durable queue or progress
  percentage. Recommendations are deterministic and do not learn from clicks.
  Duplicate detection is lexical and advisory. Schedule conflicts are advisory
  and have no travel-time buffer or blocking override.
- Attendance is a check-in record, not identity proof. QR codes/tokens can be
  shared, and camera scanning depends on browser `BarcodeDetector` support; the
  manual code field is the fallback.
- Calendar downloads are one-way ICS exports. There is no calendar
  subscription, two-way sync, or reminder scheduler.
- Feedback is limited to one response per student per event within 30 days.
  Moderation hides a response from aggregates but does not delete it.
- Analytics are descriptive aggregates and do not rank students, predict
  attendance, or make automated decisions. CSV exports are synchronous with no
  background job, signed URL, or export archive.
- The platform settings page is a configuration summary; there is no platform
  settings mutation service yet.
- This dashboard work is not a production-readiness claim; no penetration test
  has been performed.
