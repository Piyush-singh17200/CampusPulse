# Attendance, feedback, calendar, analytics, and exports

This document describes the Prompt 8 operations surface. It connects the
existing QR attendance, feedback, calendar, analytics, notification, audit, and
authorization services to role-specific pages and authenticated download routes.
All numbers come from PostgreSQL records. There is no sample, estimated, or
client-generated analytics data.

Prompt 8 applies
`prisma/migrations/20261115000000_prompt8_event_operations/migration.sql`, which
adds `attendance_credentials`, `notification_preferences`, feedback moderation
fields, the attendance/feedback/preference audit actions, and the
`ATTENDANCE_UPDATE`/`FEEDBACK_UPDATE` notification types. See
`docs/event-operations.md` for the lifecycle and notification matrix,
`docs/dashboards.md` for the route and access model, and
`docs/security-review.md` for the security addendum.

## 1. Routes

| Route                                 | Role            | Purpose                                                       |
| ------------------------------------- | --------------- | ------------------------------------------------------------- |
| `/club/attendance`                    | `CLUB_ADMIN`    | Select an event, scan or enter a code, and correct attendance |
| `/student/feedback`                   | `STUDENT`       | Submit or edit feedback for attended completed events         |
| `/club/feedback`                      | `CLUB_ADMIN`    | Review feedback for completed events in a managed club        |
| `/college/feedback`                   | `COLLEGE_ADMIN` | Review and moderate feedback across the college               |
| `/student/notifications`              | `STUDENT`       | Filter, paginate, read, and configure in-app notifications    |
| `/club/analytics`                     | `CLUB_ADMIN`    | Engagement metrics and trends for a managed club              |
| `/college/analytics`                  | `COLLEGE_ADMIN` | Engagement metrics and trends for the college                 |
| `/platform/analytics`                 | `SUPER_ADMIN`   | Cross-college aggregate metrics                               |
| `GET /api/calendar/events/[eventId]`  | `STUDENT`       | Download one published or completed same-college event as ICS |
| `GET /api/calendar/registered`        | `STUDENT`       | Download confirmed/attended registered events as ICS          |
| `GET /api/calendar/saved`             | `STUDENT`       | Download published saved events as ICS                        |
| `GET /api/exports/club/attendance`    | `CLUB_ADMIN`    | Download event attendance as CSV                              |
| `GET /api/exports/club/analytics`     | `CLUB_ADMIN`    | Download club analytics as CSV                                |
| `GET /api/exports/college/analytics`  | `COLLEGE_ADMIN` | Download college analytics as CSV                             |
| `GET /api/exports/platform/analytics` | `SUPER_ADMIN`   | Download platform analytics as CSV                            |

Every page independently calls `requireDashboardRole` and a server-only query
that rechecks the trusted actor, role, college, and managed-club membership.
Download routes call `getCurrentUser` and then the same authorization path used
by the page. A browser-supplied club, event, registration, or feedback ID is
validated against the actor's tenant and role. Unauthenticated downloads return
`401`; unauthorized or cross-tenant objects return a safe `403`/`404` with an
empty body.

## 2. QR attendance

### Student credential

- A student can open the attendance page only for their own registration.
- The registration must be `CONFIRMED`; `CANCELLED`, `ATTENDED`, and `NO_SHOW`
  registrations are rejected.
- The event must be `PUBLISHED`, the club active, and the current time inside
  the check-in window.
- The check-in window opens two hours before the event starts and closes two
  hours after it ends.
- Issuing a QR creates or rotates a 256-bit random token. Only the SHA-256 hash
  is stored in `attendance_credentials`; the raw token is returned to the
  student's page and encoded in the QR.
- The credential expires at the end of the check-in window. A used credential
  cannot be reused. Cancelling the registration, correcting attendance, or
  cancelling the event revokes outstanding credentials.
- QR issuance and credential rotation are audited with
  `ATTENDANCE_CREDENTIAL_ISSUED`.

The QR contains a CampusPulse-prefixed payload. The manual fallback accepts
either the full payload or the bare token.

### Organizer register

`/club/attendance` provides:

- a managed-club switcher and an event selector limited to non-deleted
  `PUBLISHED` and `COMPLETED` events, newest first;
- summary metrics for registered, present, pending, and attendance percentage;
- a camera scanner using the browser `BarcodeDetector` API when available;
- a manual code field for browsers or devices without camera support;
- a search filter over student name, roll number, and department;
- a status filter for all, pending, attended, and no-show rows;
- check-in timestamps and the current registration status;
- an `Export attendance CSV` link for the selected event.

The page's attendance percentage is:

```text
present / (present + pending + no-show)
```

`present` is `ATTENDED`, `pending` is `CONFIRMED`, and `no-show` is `NO_SHOW`.
The denominator excludes `CANCELLED` registrations. A null percentage is shown
when there are no eligible registrations.

### Recording and correcting attendance

- Scanning or entering a valid code calls `scanAttendance` on the server. The
  server hashes the token, loads the credential and registration, rechecks the
  event, club, registration, expiry, and current status, then records
  `ATTENDED` and `checkedInAt` in one transaction.
- A used or revoked code, expired code, wrong-event code, cancelled
  registration, inactive club, or closed window returns a safe domain error.
- The scanner never marks attendance locally; a successful scan requires the
  server response.
- Manual correction requires `ATTENDED` or `NO_SHOW` plus a reason of 3 to 500
  characters. It permits `ATTENDED` to `NO_SHOW` and `NO_SHOW` to `ATTENDED`,
  revokes outstanding credentials, and writes `ATTENDANCE_CORRECTED` or
  `ATTENDANCE_RECORDED` with the previous status, new status, reason, and
  `method: "MANUAL"`.
- The server checks that the organizer is an active president/officer of the
  owning club, a same-college college administrator, or a platform
  administrator. The Prompt 8 UI exposes the club workflow.

### Attendance CSV

`GET /api/exports/club/attendance?clubId=...&eventId=...` requires an active
managed-club manager and an event in that club and college. It returns all
registration rows for the event, including cancelled rows, with:

- student name, roll number, department;
- registration status, registration timestamp, check-in timestamp.

The CSV is UTF-8 with a byte-order mark and CRLF records. String cells that
could be interpreted as spreadsheet formulas are prefixed with an apostrophe.
The response is `text/csv; charset=utf-8`, `Content-Disposition: attachment`,
`Cache-Control: private, no-store, max-age=0`, and
`X-Content-Type-Options: nosniff`.

## 3. Feedback

### Student flow

`/student/feedback` lists the student's attended events and shows one card per
eligible event. Feedback is available only when:

- the registration belongs to the student and their college;
- the registration status is `ATTENDED`;
- the event status is `COMPLETED`;
- the current time is within 30 days of `completedAt` (or `endsAt` when a
  completed timestamp is unavailable).

The form accepts a whole-number rating from 1 to 5 and an optional comment of
up to 2,000 characters. One feedback row is allowed per event and student.
Students can edit their rating and comment while the window is open. Editing
does not clear an existing moderation decision; a hidden response remains
hidden until a college administrator restores it. Submission and edits write
`FEEDBACK_SUBMITTED` and `FEEDBACK_UPDATED` audit entries.

The page shows available, submitted, and closed states, the attendance timestamp,
the window close time, the current rating, and whether the response is visible
or hidden. When no feedback is available, it explains the attendance and
completion prerequisites instead of showing sample data.

### Club review

`/club/feedback` is read-only for club managers. It lists completed events for
the selected managed club, supports event, rating, and visibility filters, and
paginates responses in pages of 20. Summary metrics use visible feedback only:

- average rating;
- visible response count;
- hidden response count;
- rating distribution from 5 to 1.

A club manager can see hidden responses and their moderation reason but cannot
hide, restore, or delete feedback. Moderation remains a college-administrator
action.

### College moderation

`/college/feedback` supports event, club, rating, and moderation-status filters
with pagination. The Prompt 8 UI exposes moderation to college administrators;
the service also permits platform administrators. Hiding or restoring a response
requires a reason of 3 to 500 characters. Moderation
preserves the original rating and comment, records the moderator and timestamp,
and writes `FEEDBACK_MODERATED` with the previous and new visibility and the
reason. Hiding feedback removes it from averages and distributions but does not
delete the row or its audit history.

Analytics count only `VISIBLE` feedback. Hidden feedback remains visible to
authorized moderators for review.

## 4. Calendar downloads

The calendar routes are authenticated downloads. They are not a two-way
calendar sync and do not create, update, or delete events in an external
calendar.

| Scope             | Included events                                                                       |
| ----------------- | ------------------------------------------------------------------------------------- |
| Single event      | Same-college `PUBLISHED` or `COMPLETED` event with an active club                     |
| Registered events | The student's `CONFIRMED` and `ATTENDED` registrations for published/completed events |
| Saved events      | The student's saved events that are currently published with an active club           |

Drafts, pending, rejected, and cancelled events are excluded. Cross-college
events and deleted events are excluded. The single-event route returns `404`
when the event is not available to that student.

Each response is an RFC 5545 calendar with:

- `VERSION:2.0`, `PRODID`, `CALSCALE:GREGORIAN`, and `METHOD:PUBLISH`;
- a calendar name and the college IANA timezone in `X-WR-CALNAME` and
  `X-WR-TIMEZONE`;
- UTC `DTSTART` and `DTEND` values;
- escaped `SUMMARY`, `DESCRIPTION`, `LOCATION`, `CATEGORIES`, and organizer;
- a stable opaque `UID` derived from the event ID;
- an `SEQUENCE` value derived from the event update time;
- a link back to the CampusPulse event page.

Calendar exports are bounded to 500 events. The response is
`text/calendar; charset=utf-8`, `Content-Disposition: attachment`, private and
non-cacheable. Calendar clients may import the file, but CampusPulse does not
claim synchronization or delivery guarantees.

## 5. Analytics

### Shared filters

All analytics views accept `from` and `to` dates (inclusive, interpreted as UTC
day boundaries). Club and college views also accept `eventId`, `category`,
`club` or `clubId`, and event `status`. The platform view exposes a date range
and event status filter. Filters are validated and normalized server-side;
unknown values are ignored rather than interpolated into SQL.

The default range is a rolling six-month window ending at the end of today. An
explicit range is used by the browser tests when future events must be included.
Event metrics are selected by event `startsAt` within the range. Registration
and feedback metrics are joined to those events, so a registration is counted
only when its event is in range.

### Metric definitions

| Metric                | Definition                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| Events                | Non-deleted events in the selected range and filters                          |
| Published             | Events with status `PUBLISHED`                                                |
| Pending approvals     | Events with status `PENDING_APPROVAL`                                         |
| Completed             | Events with status `COMPLETED`                                                |
| Registrations         | All registration rows for events in range                                     |
| Active registrations  | `CONFIRMED` plus `ATTENDED`                                                   |
| Cancelled             | `CANCELLED` registrations                                                     |
| Present               | `ATTENDED` registrations                                                      |
| No-show               | `NO_SHOW` registrations                                                       |
| Eligible              | `CONFIRMED` + `ATTENDED` + `NO_SHOW`                                          |
| Attendance rate       | `ATTENDED / eligible`, rounded to one decimal; null when eligible is zero     |
| Completion rate       | `COMPLETED / (PUBLISHED + COMPLETED)`, rounded to one decimal; null when zero |
| Average rating        | Average rating of `VISIBLE` feedback only; null when there is no feedback     |
| Feedback responses    | Count of `VISIBLE` feedback rows                                              |
| Feedback distribution | `VISIBLE` feedback grouped by rating from 5 to 1                              |

Platform analytics also show active colleges, active users, and aggregate event
counts by college. Platform college activity exposes only college names and
event counts, not student-level records.

### Trends and breakdowns

- Events by start month.
- Registrations by registration month.
- Attendance by check-in month.
- Category mix (club/college).
- Club activity (college).
- Event status distribution.
- Rating distribution.
- Most-attended events.
- Low-attendance events: events below 50% attendance with eligible
  registrations.
- Per-event breakdown with registrations, active, cancelled, attended,
  no-show, eligible, attendance rate, average rating, and feedback count.

Club and college monthly trends are aggregated in PostgreSQL over the complete
selected event set; the dashboard does not load every registration into Node or
silently stop at a fixed row count. Platform trends are intentionally bounded to
5,000 matching events and 5,000 matching registrations per chart, and the UI
shows an explicit truncation notice when that bound is reached. College activity
uses the first 5,000 matching events and carries the same visible notice.

The club attendance roster is filtered and paginated on the server (50 rows per
page by default, 100 maximum). Attendance CSV exports are not limited to 10,000
rows; they use the same tenant scope and formula-protection rules as the other
exports.

### Analytics CSV

The three analytics CSV routes reuse the page authorization and filter
normalization. Club and college CSV files contain one row per event in the
breakdown with club, event, start time, status, registration counts, attendance,
and visible feedback metrics. Platform CSV files contain summary metrics and
college activity rows. All CSV responses use the same UTF-8 BOM, CRLF, formula
protection, attachment filename, and no-store headers as attendance CSV.

## 6. Notifications

`/student/notifications` reads only rows addressed to the signed-in student in
their college. It supports:

- all/unread filters;
- notification type filters with per-type counts;
- pagination in pages of 10 (maximum page size 50);
- a mark-one-read action and a mark-all-read action;
- deep links through `actionUrl`, restricted to safe same-origin paths;
- a preferences form for registration, attendance, and feedback in-app
  categories.

Preferences are stored in `notification_preferences` per user. Missing rows use
the default of all three categories enabled. Updates are validated as booleans,
upserted in a transaction, and audited as
`NOTIFICATION_PREFERENCES_UPDATED`. Optional categories are filtered when the
notification row is created, in the same transaction as the state change. There
is no email, SMS, or push delivery and no background outbox.

Notification pages show loading skeletons, accessible empty states, read/unread
badges, timestamps, and responsive layouts. The unread count and type counts
are database counts, not client-side approximations.

## 7. Accessibility and responsive behavior

- Forms use visible labels, fieldset/legend grouping, native selects and
  checkboxes, and focus-visible outlines.
- Tables have column headers and horizontal scrolling only when a wide register
  or breakdown needs it.
- Status and moderation messages use `role="status"` or `role="alert"` with
  live regions.
- Loading states use a status role and a screen-reader label.
- Error boundaries show a generic message and an optional request digest, not
  raw server errors.
- Empty states explain the prerequisite or filter that produced no rows.
- The attendance and notification pages were checked at 390 px without
  horizontal page overflow. Desktop screenshots use a 1440 px viewport.

## 8. Tests and screenshots

Prompt 8 adds four unit/integration suites (26 tests) covering:

- attendance window, QR issuance, scan success/failure, corrections, reasons,
  authorization, revocation, and audit metadata;
- feedback eligibility, submission, editing, moderation, visibility, and
  tenant scoping;
- ICS escaping, folding, UID stability, download scopes, and CSV BOM/CRLF/
  formula protection;
- analytics filters and aggregates, CSV authorization, notification filters,
  pagination, preferences, and read state.

The Playwright workflow in `tests/e2e/prompt-8.spec.ts` creates and publishes an
event, registers a student, moves the event into the attendance window, issues a
QR, records attendance with the manual code, downloads attendance CSV, completes
the event, submits and reviews feedback, downloads all three ICS scopes and all
four CSV scopes, checks analytics, exercises notification filters and
preferences, verifies responsive attendance/notification layouts, and cleans up
its event. It also checks that unauthenticated exports are rejected.

Screenshots are stored in `docs/screenshots/prompt-8/`:

- `01-club-attendance-1440.png`
- `02-student-feedback-1440.png`
- `03-college-feedback-1440.png`
- `04-club-feedback-1440.png`
- `05-club-analytics-1440.png`
- `06-college-analytics-1440.png`
- `07-platform-analytics-1440.png`
- `08-student-notifications-1440.png`
- `09-student-notifications-390.png`
- `10-club-attendance-390.png`

## 9. Limitations

- Attendance is a check-in record, not proof of identity. A student can share a
  QR code or token; organizers should use the manual register and reason field
  when a correction is needed.
- The camera scanner depends on browser `BarcodeDetector` support. Manual code
  entry remains available.
- Calendar files are download-only. There is no two-way sync, subscription feed,
  reminder delivery, or calendar-provider integration.
- Notifications are in-app only. Preferences control optional in-app
  categories, not email/SMS/push delivery.
- Analytics are descriptive aggregates. They do not rank students, predict
  attendance, or make automated decisions.
- Feedback is limited to one response per student per event and a 30-day
  window. Moderation hides a response from aggregates but does not delete it.
- CSV exports are synchronous and materialized in memory. There is no fixed
  attendance-row cap, background job, signed URL, or long-term export archive.
- Tenant isolation remains application-layer scoping plus composite foreign
  keys; PostgreSQL RLS is not implemented.
- There is no production object storage, email provider, deployment, or
  penetration test in this phase.
