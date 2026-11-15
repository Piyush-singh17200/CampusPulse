# Role dashboards, routes, and Server Actions

Prompt 5 implements four authenticated, role-specific CampusPulse dashboards.
Prompt 6 extends them with event poster management, authenticated poster
delivery, and transactional in-app notifications. Prompt 7 adds local poster
OCR review, student recommendations, advisory duplicate review, and schedule-
conflict warnings. Every page reads real PostgreSQL data through server-only
query functions and every mutation goes through a Server Action backed by an
existing domain service. No dashboard exposes Prisma to client components and
no public business API was added. See `docs/event-intelligence.md` for the
feature algorithms and limitations.

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
| `/student/calendar`         | Registrations grouped by college-local date         |
| `/student/notifications`    | User notifications and read state                   |
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
| `/club/attendance`            | Mark attended/no-show after an event starts           |
| `/club/analytics`             | Status, registration, category, and event breakdowns  |
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
| `/college/analytics`        | College event/registration/approval analytics    |
| `/college/audit-logs`       | Paginated, action-filtered college audit history |
| `/college/settings`         | College name, short name, and IANA timezone      |

### Platform administrator

| Route                            | Purpose                                             |
| -------------------------------- | --------------------------------------------------- |
| `/platform`                      | Platform overview and recent cross-college activity |
| `/platform/colleges`             | Searchable, filterable, paginated college list      |
| `/platform/colleges/[collegeId]` | College detail, users, clubs, audit, lifecycle      |
| `/platform/users`                | Platform-wide user search and filters               |
| `/platform/analytics`            | Cross-college status and growth analytics           |
| `/platform/audit-logs`           | Platform-wide audit history with action filter      |
| `/platform/settings`             | Read-only platform configuration summary            |

Each workspace has a role-specific layout plus `loading.tsx` and `error.tsx`
states. Empty states are rendered per section rather than as fake sample data.

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
  notifications read, update profile.
- Club: create draft (with optional poster), update event, transition event,
  upload/replace/remove poster, update club profile, mark attendance.
- College: approve/reject club, change user role/status, update college
  settings.
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
- The dashboard notification page reads and marks existing notification rows as
  read. Email/push/SMS delivery is not configured.

## 7. Event intelligence surfaces

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

## 8. UI and responsive behavior

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
disabled; the only `style-src-attr` allowance is a hash for Next.js's internal
route-announcer element.

The dashboard routes are designed for 360, 390, 768, 1024, 1280, and 1440 pixel
widths. Tables scroll horizontally only where a wide audit view needs it; the
primary dashboard content stacks on narrow screens. Loading, empty, error, and
not-found states are implemented per workspace.

## 9. Tests

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
  warnings, and responsive layouts.

All tests run against the isolated `campuspulse_test` database. The dashboard,
Prompt 6, and Prompt 7 migrations are applied by the test global setup through
`prisma migrate deploy`. The Prompt 7 suite was verified with 24 test files /
189 tests passing.

## 10. Visual verification

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

The final browser pass exercised 360, 390, 768, 1024, 1280, and 1440 pixel
widths. Every role had zero horizontal overflow, the mobile navigation drawer
opened with all role links and closed with Escape, and all four workspaces had
zero console or page errors.

## 11. Known limitations

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
- There is no QR check-in flow.
- The platform settings page is a configuration summary; there is no platform
  settings mutation service yet.
- This dashboard work is not a production-readiness claim; no penetration test
  has been performed.
