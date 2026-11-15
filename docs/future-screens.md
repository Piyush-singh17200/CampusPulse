# Future screen specifications

These screens began as specifications. Prompt 5 implements the student, club
administrator, college administrator, and platform administrator dashboard
routes described here; see `docs/dashboards.md` for the actual route map and
authorization model. Prompt 6 implements event poster upload, replacement, and
removal with authenticated delivery; see `docs/poster-storage.md` and
`docs/event-operations.md`. Prompt 7 implements local poster OCR review,
deterministic recommendations, advisory duplicate review, and schedule-conflict
warnings; see `docs/event-intelligence.md`. Crop/focal-point editing, semantic
duplicate detection, email/push/SMS notification delivery, and QR check-in
remain future work. The service-layer rules in `src/services` remain the backend
contract.

Common requirements for every screen:

- The authenticated session supplies the actor identity on the server. Never
  accept `userId`, `role`, `collegeId`, club ownership, or event ownership from
  the browser.
- Load data through tenant-scoped services. Render a non-enumerating not-found
  state for cross-tenant access.
- Every mutation must show a pending state, prevent duplicate submission, and
  display the resulting state after success.
- Use the design-system primitives and tokens in `docs/design-system.md`.
- Loading uses skeletons for layout-preserving areas; empty and error states use
  the shared `EmptyState` and `ErrorState` patterns.
- Mobile layouts stack primary content first, keep destructive actions out of
  accidental reach, and use labelled stacked records instead of wide tables.
- Dates show the college timezone; capacity and registration deadlines are
  always explicit.

## Student screens

### 1. Student dashboard

**Purpose:** Give a student a single starting point for what is relevant this
week and what needs attention.

**Main components:** Greeting and college context; “Next up” event card;
personalized feed preview; registration-status strip; saved-event shortcut;
notification summary; interest chips; empty-state call to explore.

**Data required:** Student profile and college; published events in the same
college; registrations with status and timestamps; saved events; unread
notifications; interest names; event categories, dates, venue, capacity, and
poster fallback.

**User actions:** Open event, register, cancel, save/unsave, open notifications,
edit interests, browse all events.

**Loading state:** Dashboard skeleton with one featured card and three compact
rows; preserve layout and do not show fake counts.

**Empty state:** “Your week is quiet” with a link to explore events and a prompt
to add interests.

**Error state:** Section-level error with retry; if the profile fails to load,
show a safe account-support message without exposing database details.

**Permissions:** Authenticated student in an active college. Only the student's
own registrations, saves, and notifications are visible.

**Mobile layout:** Single column; “Next up” first, then quick actions, then feed.
Sticky bottom navigation is optional and must not cover content.

### 2. Personalized event feed

**Purpose:** Show a ranked, explainable list of events relevant to the student.

**Main components:** Filter bar (category, date, format, availability); feed
cards; “Why this is here” explanation; pagination or infinite-load control;
empty-state suggestions.

**Data required:** Published events in the student's college; interests; event
categories; registration counts/capacity; saved state; registration state;
ranking inputs and explanation labels. No cross-college events.

**User actions:** Filter, sort, save, register, open detail, dismiss an item,
adjust interests.

**Loading state:** Card skeletons in the feed grid; keep filters usable.

**Empty state:** Explain which filters produced no results and offer a reset.

**Error state:** Preserve filters, show retry, and avoid replacing the whole page
with a generic error.

**Permissions:** Authenticated student. Recommendations must not reveal another
student's data or another college's events.

**Mobile layout:** Filters collapse into a sheet; one-column cards; sticky
“Filters” button with an active-filter count.

### 3. Event exploration

**Purpose:** Browse the full published campus calendar without personalization
pressure.

**Main components:** Search input; category/date/format filters; result count;
event grid/list toggle; featured event; pagination; no-results panel.

**Data required:** Published events for the student's college; categories;
venue; start/end; registration window; capacity; poster; club name; saved and
registration status for the current student.

**User actions:** Search, filter, clear filters, open event, save, register.

**Loading state:** Search-results skeleton; debounce search and show a subtle
“Updating results” indicator.

**Empty state:** “No events match these filters” with clear reset and browse-all
actions.

**Error state:** Keep the last successful results if possible; show a retry
banner rather than discarding the query.

**Permissions:** Authenticated student; only published events in the same
college. Draft, pending, rejected, cancelled, and completed events are excluded
from discovery.

**Mobile layout:** Search first, filter sheet, one-column cards, list variant for
dense results.

### 4. Event detail

**Purpose:** Give the student enough information to decide and register safely.

**Main components:** Poster or fallback artwork; title; club and category;
date/time with timezone; venue or online link; description; capacity/remaining
places; registration window; registration button and status; cancellation
action; save action; accessibility notes; related events.

**Data required:** Event and club; categories; college; poster/alt text;
registration counts; current student's registration; saved state; registration
open/deadline/start times; cancellation state; online URL.

**User actions:** Register, cancel registration, save/unsave, add to calendar,
open map/online link, share (future).

**Loading state:** Detail skeleton with poster, title, and metadata placeholders.

**Empty state:** Not applicable to a valid detail; use not-found for missing
events. If related events are empty, omit that section.

**Error state:** Non-enumerating not-found for cross-tenant or deleted events;
retry for transient failures; do not show raw SQL or internal IDs.

**Permissions:** Authenticated student in the event's college. Registration is
only offered when the event is published, the club is active, the window is
open, the event has not started, and capacity remains.

**Mobile layout:** Poster full-width, title and primary action above the fold,
sticky bottom action bar with safe-area padding, details below.

### 5. Registration history

**Purpose:** Let a student review and manage past and upcoming registrations.

**Main components:** Tabs for upcoming/past/cancelled; event summary rows;
status badges; cancellation action; calendar links; pagination.

**Data required:** Student profile; registrations with status, registeredAt,
cancelledAt, checkedInAt; event title, date, venue, club; college timezone.

**User actions:** Open event, cancel upcoming registration, add to calendar,
filter by status.

**Loading state:** Row skeletons grouped by tab.

**Empty state:** “No registrations yet” with an explore-events action; separate
copy for cancelled-only history.

**Error state:** Retry per tab; do not show another student's rows.

**Permissions:** Student may see only their own registrations. Cancellation is
allowed only from `CONFIRMED` and only through the registration service.

**Mobile layout:** Stacked rows with status first, date second, action last;
tabs become a horizontal scrollable control or segmented control.

### 6. Saved events

**Purpose:** Keep a shortlist of events the student wants to revisit.

**Main components:** Saved-event cards; sort by date/saved date; remove action;
registration status; empty state.

**Data required:** Saved-event join (future model or user preference); published
event details; current registration state; college scope.

**User actions:** Remove saved event, open event, register, clear all with
confirmation.

**Loading state:** Card skeletons; preserve count after removal optimistically
only if rollback is implemented.

**Empty state:** “Nothing saved yet” with an explore action and a short
explanation of saving.

**Error state:** If a saved event was unpublished, show it as unavailable and
offer removal rather than a broken card.

**Permissions:** Authenticated student; only their own saved list and same-college
events.

**Mobile layout:** One-column cards; swipe actions are optional and must have a
visible button equivalent.

### 7. Calendar

**Purpose:** Show the student's registered and saved events in time context.

**Main components:** Month/week toggle; date grid; event chips; selected-day
list; timezone label; “add to calendar” export.

**Data required:** Registrations, saved events, event start/end, venue, college
timezone, status. Cancelled events are shown as cancelled, not silently removed.

**User actions:** Change view, select a day, open event, export ICS, filter to
registered/saved.

**Loading state:** Calendar shell with skeleton event chips; keep navigation
usable.

**Empty state:** “No events on the calendar” with explore and saved-event links.

**Error state:** Show retry and retain the current month; do not reset the user's
position without explanation.

**Permissions:** Student's own registrations and saves only; same-college events.

**Mobile layout:** Agenda/list view by default; month grid optional; event chips
truncate with accessible full labels.

### 8. Profile and interests

**Purpose:** Maintain the student's identity and personalization inputs.

**Main components:** Profile summary; editable name/department/year/bio; interest
selector; notification preferences; college context; save/cancel bar.

**Data required:** User name/email; student profile roll number, department,
graduation year, bio; interests; selected interests; notification preferences;
college timezone.

**User actions:** Edit profile fields, add/remove interests, update notification
preferences, save, cancel.

**Loading state:** Form skeleton with disabled controls; do not prefill with
another user's data.

**Empty state:** Prompt to add department/year/interests; do not block core
browsing.

**Error state:** Field-level errors plus a summary; preserve edits; server
validation errors must not expose internal details.

**Permissions:** Student may edit only their own profile and interests. Role and
college are not editable here.

**Mobile layout:** Single-column form; sticky save bar; interest chips wrap and
remain tappable.

### 9. Notifications

**Purpose:** Keep students informed about registration, moderation, and event
changes.

**Main components:** Filter tabs (all/unread); notification list; type icon;
timestamp; mark-read; mark-all-read; action link; empty state.

**Data required:** Notifications for the current user and college; type, title,
body, actionUrl, readAt, createdAt; related event/registration status.

**User actions:** Open notification, mark read/unread, mark all read, follow
action link.

**Loading state:** List skeleton; preserve unread count while loading.

**Empty state:** “You're all caught up” with a link to notification preferences.

**Error state:** Retry; do not mark items read if the mutation failed.

**Permissions:** Authenticated user; own notifications only. No cross-college or
cross-user notification access.

**Mobile layout:** Full-width list rows; filter tabs sticky below the header;
action links have 44 px targets.

## Club administrator screens

### 10. Club dashboard

**Purpose:** Give a club administrator a health check and next actions for their
club.

**Main components:** Club identity and status; membership count; upcoming events;
pending approvals; registration totals; quick actions (create event, manage
registrations, edit club); audit/activity preview.

**Data required:** Club and college; active memberships; events by status;
registration counts; upcoming dates; recent audit entries for the club.

**User actions:** Create draft, submit event, edit draft, open registrations,
manage members, update club profile.

**Loading state:** Summary cards and event-list skeletons.

**Empty state:** “No events yet” with create-draft action; explain that drafts
require college approval before publishing.

**Error state:** Section-level retry; if the club is suspended or archived, show
the status and disable mutations with an explanation.

**Permissions:** Active `CLUB_ADMIN` with an active president/officer membership
for this club. College admins may view but should not see club-admin-only
actions unless explicitly supported.

**Mobile layout:** Summary cards stacked; primary action visible; event rows
stacked with status and date first.

### 11. Event creation

**Purpose:** Create a complete draft event with safe defaults.

**Main components:** Multi-step or single-page form: basics, schedule,
registration, venue/online, capacity, categories, poster, review; save-draft and
submit-for-review actions; validation summary.

**Data required:** Actor's authorized clubs; college categories; timezone;
existing slug availability; club status; policy text.

**User actions:** Save draft, submit for approval, add categories, upload a
JPEG/PNG/WebP poster, preview, discard with confirmation.

**Loading state:** Submit pending state; disable duplicate submission; show
“Saving draft…” then the resulting status.

**Empty state:** Not applicable; if no active club is available, show an
authorization/empty state instead of a broken form.

**Error state:** Field-level errors, server validation summary, and safe failure
copy; never trust browser capacity/date validation alone.

**Permissions:** Active club administrator for the selected club; club must be
active. Students and college admins cannot create club events unless a future
policy explicitly grants it.

**Mobile layout:** One field group per screen section; sticky save/submit bar;
date/time inputs use native pickers where possible.

### 12. Event editing

**Purpose:** Correct a draft or rejected event before resubmission.

**Main components:** Same form as creation; current status banner; rejection
reason; change summary; poster manager; save and submit actions; audit/activity
note.

**Data required:** Event and club; current fields; status; rejection reason;
registration count; categories; poster; audit history.

**User actions:** Edit draft/rejected fields, upload/replace/remove a poster for
allowed statuses, save, resubmit, cancel pending event, view rejection reason.

**Loading state:** Form skeleton; disable save until the current version loads.

**Empty state:** Not applicable; show not-found if the event is missing or
cross-tenant.

**Error state:** Conflict state if another editor changed the event; reload and
explain. Field errors preserve input.

**Permissions:** Club manager for the event's active club; only `DRAFT` and
`REJECTED` event fields are editable. Poster upload/replace/remove is also
allowed for `PUBLISHED` events, but locked for `PENDING_APPROVAL`, `CANCELLED`,
and `COMPLETED`. The current service also allows a college administrator in the
event's college to edit a draft/rejected event; a stricter product policy can
separate review from editing if desired. Platform administrators can act across
colleges but cannot create a club-owned event because of the composite creator
foreign key.

**Mobile layout:** Single column; status/rejection banner first; sticky action
bar; destructive actions in an overflow menu with confirmation.

### 13. Poster upload

**Status:** Implemented in Prompt 6. Local OCR review is implemented in Prompt 7.
Crop/focal-point editing remains future work.

**Purpose:** Attach a safe, accessible poster to an event.

**Main components:** File picker; JPEG/PNG/WebP requirements; preview; alt-text
field; current-poster display; replace/remove actions; safe broken-image
fallback. Crop/focal point remains a future addition; OCR status is available
on the separate OCR review surface.

**Data required:** Event/club authorization; detected MIME type, byte size,
dimensions, and alt text; a server-generated storage key that is never exposed
to the browser; OCR status and extracted fields for draft/rejected events.

**User actions:** Choose file, preview, set alt text, upload, replace, remove.
OCR is an explicit separate action that never blocks upload or manual editing.

**Loading state:** Upload/replace pending state; prevent duplicate submissions.

**Empty state:** “No poster yet” with requirements and an optional skip.

**Error state:** Clear file-type/size/dimension errors; retry; do not expose
storage paths, credentials, or raw provider errors.

**Permissions:** Active owning-club president/officer for `DRAFT`, `REJECTED`,
and `PUBLISHED` events. Locked for `PENDING_APPROVAL`, `CANCELLED`, and
`COMPLETED`. Students and college administrators cannot upload.

**Mobile layout:** Camera/gallery picker; preview full-width; alt-text field
below; upload button sticky.

### 14. OCR review

**Status:** Implemented in Prompt 7 as an explicit local Tesseract.js action with
per-field human review. It is available only for `DRAFT`/`REJECTED` events with
a primary poster and never publishes, submits, or approves an event.

**Purpose:** Let a club administrator confirm text extracted from a poster before
using it.

**Main components:** Poster preview; extracted text editor; confidence/status
badge; field mapping (title/date/venue); accept/reject; retry; explanation of
OCR limits.

**Data required:** Poster and OCR text/status; event fields; reviewer identity;
timestamps; audit trail.

**User actions:** Edit extracted text, accept mapped fields, reject, retry OCR,
save changes.

**Loading state:** Processing spinner and status; keep the poster visible.

**Empty state:** “No OCR result yet” with request action when a poster exists.

**Error state:** OCR failure with retry and manual-entry fallback; never block
event creation on OCR.

**Permissions:** Active owning-club president/officer for a draft or rejected
event. College administrators can view the poster but cannot run OCR or apply
suggestions. No automatic publishing from OCR.

**Mobile layout:** Poster preview then extracted text; accept/reject actions
sticky; long text uses a full-screen editor.

### 15. Registration management

**Purpose:** Let a club administrator understand and manage event attendance.

**Main components:** Event selector; capacity/confirmed/waitlist summary; search;
status filters; attendee table/list; check-in action; export; cancellation with
reason; pagination.

**Data required:** Event and club; registrations with student display name,
roll/department (minimum necessary), status, registeredAt, checkedInAt; capacity;
audit entries.

**User actions:** Search, filter, check in, mark no-show, cancel registration,
export CSV (future), message attendees (future).

**Loading state:** Table/list skeleton; preserve filters and counts.

**Empty state:** “No registrations yet” with a share/preview action.

**Error state:** Retry; show conflict if capacity/status changed; do not silently
drop a registration.

**Permissions:** Club manager for the event; college admin may view within the
college. Students cannot access the attendee list. Do not expose unnecessary
personal data.

**Mobile layout:** Stacked attendee cards; check-in primary action; filters in a
sheet; export in overflow.

### 16. Club analytics

**Purpose:** Show a club administrator useful, non-vanity event performance.

**Main components:** Date range; events published; registration conversion;
capacity utilization; attendance rate; category mix; cancellation rate; trend
chart; export.

**Data required:** Club events; registration statuses; capacity; dates; category
joins; college timezone; aggregated data only.

**User actions:** Change range, filter by event/category, export, open event.

**Loading state:** Chart and metric skeletons; keep range controls usable.

**Empty state:** “Not enough data yet” with guidance after the first event.

**Error state:** Section-level retry; do not show partial charts as complete.

**Permissions:** Club manager for the club; college admin may view college-wide
analytics separately. No individual student data beyond necessary counts.

**Mobile layout:** Metric cards stacked; charts horizontal-scroll only if
necessary, with a table fallback.

## College administrator screens

### 17. College dashboard

**Purpose:** Give a college administrator an operational overview and review
queue.

**Main components:** College status; pending clubs; events awaiting approval;
duplicate candidates; upcoming events; registration totals; user role summary;
audit preview; quick actions.

**Data required:** College and settings; counts by status; pending clubs/events;
duplicate candidates; upcoming events; recent audit logs; user counts by role.

**User actions:** Open review queues, approve/reject, view analytics, manage
users, open audit logs.

**Loading state:** Metric and queue skeletons.

**Empty state:** “Nothing needs review” with links to analytics and settings.

**Error state:** Section-level retry; if the college is suspended/archived, show
status and disable mutations.

**Permissions:** `COLLEGE_ADMIN` for this college. Super admin may view across
colleges. Club admins and students cannot access.

**Mobile layout:** Review queues first; metric cards stacked; avoid wide tables.

### 18. Club approval

**Purpose:** Review a proposed club and make an auditable decision.

**Main components:** Queue; club profile; creator; description; requested
category; status; approve/reject actions; reason field; audit note.

**Data required:** Pending clubs in the college; creator identity; description;
createdAt; status; reviewer; decision reason.

**User actions:** Approve, reject with reason, open creator profile, filter queue.

**Loading state:** Queue skeleton; disable decision buttons while submitting.

**Empty state:** “No clubs waiting for review.”

**Error state:** Conflict if another admin already decided; refresh and explain.
Rejection requires a reason.

**Permissions:** College admin in the same college or super admin. Club admins
cannot approve their own club.

**Mobile layout:** Queue list then detail; decision actions sticky; reason
textarea full-width.

### 19. Event moderation

**Purpose:** Review submitted events for publishing or rejection.

**Main components:** Queue filters (pending/rejected/published); event preview;
club context; schedule; capacity; poster; description; approve/reject; reason;
audit history.

**Data required:** Pending events in the college; club; creator; categories;
poster/alt text; dates; registration window; capacity; prior audit entries.

**User actions:** Approve, reject with reason, open event detail, filter, request
changes (future).

**Loading state:** Queue and preview skeletons; keep selection stable.

**Empty state:** “No events awaiting moderation.”

**Error state:** Conflict if the event changed or was already reviewed; refresh
the queue. Invalid transitions return a clear conflict message.

**Permissions:** College admin in the event's college or super admin. Club admins
cannot publish or reject.

**Mobile layout:** List first, then a full-screen detail; approve/reject in a
sticky action bar; rejection reason in a dialog.

### 20. Duplicate review

**Status:** Implemented in Prompt 7 as an advisory, same-college review queue.
It never merges, rejects, cancels, or deletes either event.

**Purpose:** Resolve suspected duplicate events without deleting history.

**Main components:** Candidate pair; side-by-side event comparison; confidence;
title/date/venue/club signals; confirm duplicate; dismiss; audit history.

**Data required:** EventDuplicate pair in the college; both events; confidence;
reasons; reviewer; status; timestamps; audit history.

**User actions:** Compare, confirm duplicate, dismiss.

**Loading state:** Server-rendered queue with pending submission state on the
review action; keep the queue count visible.

**Empty state:** “No duplicate candidates.”

**Error state:** Conflict if another reviewer resolved it; refresh; do not
auto-merge without an explicit action.

**Permissions:** College admin in the same college. Club admins and platform
admins cannot resolve duplicate suggestions.

**Mobile layout:** Stacked comparison cards with a sticky decision bar; allow
horizontal comparison only as an enhancement.

### 21. User management

**Purpose:** Manage college users and roles safely.

**Main components:** Search; role/status filters; user table/list; role change
dialog; status actions; audit history; pagination.

**Data required:** Users in the college; name/email; role; status; student
profile summary; club memberships; lastSeenAt; audit entries.

**User actions:** Search, filter, change role, suspend/disable (future policy),
view audit, invite user (future).

**Loading state:** Table/list skeleton; preserve filters.

**Empty state:** “No users match these filters.”

**Error state:** Field/dialog errors; conflict on stale role; no self-escalation.
Never allow a college admin to grant `SUPER_ADMIN`.

**Permissions:** College admin for the college; super admin across colleges. No
self role changes. Club admins cannot manage college-wide roles.

**Mobile layout:** Stacked user cards; role action in a dialog; filters in a
sheet.

### 22. College analytics

**Purpose:** Understand college-wide event activity, moderation, and engagement.

**Main components:** Date range; published events; approval turnaround; club
participation; registration and attendance rates; category mix; top clubs;
export.

**Data required:** Aggregated college events, clubs, registrations, moderation
timestamps, categories, statuses. No unnecessary personal data.

**User actions:** Change range, filter by club/category, export, drill into a
club or event.

**Loading state:** Metric/chart skeletons; range controls remain usable.

**Empty state:** “Not enough activity yet” with guidance.

**Error state:** Section-level retry; label partial data clearly.

**Permissions:** College admin for the college or super admin. Club admins see
only their club analytics.

**Mobile layout:** Summary cards first; charts with accessible table fallback.

### 23. Audit logs

**Purpose:** Provide a trustworthy, read-only record of important actions.

**Main components:** Filters (date, actor, action, entity); result table/list;
actor; action; entity; college; metadata summary; timestamp; pagination; export
(future).

**Data required:** Audit logs scoped to the college (or platform for super
admin); actor name/email; action; entity type/id; redacted metadata; createdAt.

**User actions:** Filter, search, open related entity, export (future). No edit or
delete actions.

**Loading state:** Table/list skeleton; preserve filters.

**Empty state:** “No audit events match these filters.”

**Error state:** Retry; do not expose raw metadata secrets. Redaction must happen
before storage and again before rendering if needed.

**Permissions:** College admin for the college; super admin for platform scope.
Club admins see only club-scoped audit if a future policy allows it; students
have no access.

**Mobile layout:** Stacked audit cards with action and timestamp first; metadata
collapsed by default.

### 24. College settings

**Purpose:** Configure college identity and operational defaults.

**Main components:** Name/short name/domain; timezone; status; moderation
defaults; notification defaults; save/cancel; danger zone (future).

**Data required:** College profile, settings JSON, timezone, status, audit
history.

**User actions:** Edit safe settings, change timezone with warning, save, view
audit. Status changes should require super-admin policy if added.

**Loading state:** Form skeleton; disable save until loaded.

**Empty state:** Not applicable; show not-found if the college is missing.

**Error state:** Field-level errors and conflict on stale updates; never expose
database credentials.

**Permissions:** College admin for the college; super admin across colleges.
Domain/status changes may require a stricter policy.

**Mobile layout:** Single-column form; sticky save bar; long settings grouped
into sections.

## Super administrator screens

### 25. Platform dashboard

**Purpose:** Give the platform operator a high-level health and risk view.

**Main components:** College counts by status; active users; pending colleges;
platform-wide event moderation summary; failed jobs/health (future); recent
platform audit; quick links.

**Data required:** Aggregated college, user, club, event, registration, and audit
counts; health status. Avoid individual student data unless necessary.

**User actions:** Open colleges, review platform analytics, open settings, inspect
audit.

**Loading state:** Metric skeleton grid.

**Empty state:** “No colleges yet” with a college-creation action (future).

**Error state:** Section-level retry; health failures must be explicit.

**Permissions:** `SUPER_ADMIN` only. College admins see only their college.

**Mobile layout:** Metric cards stacked; quick actions in a short grid; no dense
platform table above the fold.

### 26. College management

**Purpose:** Create, configure, suspend, and archive colleges.

**Main components:** Search/filter; college table/list; status; primary domain;
timezone; user/event counts; create college; edit; suspend/archive confirmation;
audit.

**Data required:** Colleges, status, settings, counts, audit entries. Do not
delete colleges with dependent records.

**User actions:** Create, edit, suspend, archive, restore (future), open college,
view audit.

**Loading state:** Table/list skeleton; preserve filters.

**Empty state:** “No colleges match these filters.”

**Error state:** Conflict for duplicate domain/slug; destructive confirmations
name the college and consequence; no hard delete.

**Permissions:** Super admin only. College admins cannot create or archive
colleges.

**Mobile layout:** Stacked college cards; status and domain visible; actions in
a labelled menu with confirmation.

### 27. Platform settings

**Purpose:** Manage platform-wide defaults and integrations safely.

**Main components:** Platform identity; feature flags (future); email/SMTP
status (future); local OCR runtime status; security settings; audit; save
confirmation.

**Data required:** Platform configuration (non-secret values), integration
status, feature flags, audit history. Secrets are write-only and never rendered.

**User actions:** Edit safe defaults, toggle features, update integration
metadata, save, view audit.

**Loading state:** Form skeleton; mark unloaded secret fields as “configured” or
“not configured,” never display values.

**Empty state:** Not applicable; show configuration prompts.

**Error state:** Validation and integration errors; never log or render secrets.

**Permissions:** Super admin only; sensitive changes require confirmation and
audit.

**Mobile layout:** Grouped single-column sections; sticky save; secret fields
masked.

### 28. Platform analytics

**Purpose:** Understand adoption, moderation load, and reliability across
colleges.

**Main components:** Date range; college growth; active users; event/registration
totals; moderation turnaround; status distribution; top colleges; export.

**Data required:** Aggregated cross-college data, moderation timestamps, status
counts, health metrics. Minimize personal data.

**User actions:** Change range, filter by college/status, export, drill into a
college.

**Loading state:** Metric and chart skeletons.

**Empty state:** “Not enough platform data yet.”

**Error state:** Section-level retry; label partial data and timezone boundaries.

**Permissions:** Super admin only. No student-level browsing from analytics
without a separate justified workflow.

**Mobile layout:** Summary cards, then charts with table fallback; filters in a
sheet.

## Cross-screen permission summary

| Capability                             | Student | Club admin                | College admin                    | Super admin               |
| -------------------------------------- | ------- | ------------------------- | -------------------------------- | ------------------------- |
| Browse published events in own college | yes     | yes                       | yes                              | yes                       |
| Register/cancel own registration       | yes     | if student profile exists | if student profile exists        | if student profile exists |
| Create/edit own club draft             | no      | yes                       | no                               | policy-dependent          |
| Upload/replace/remove event poster     | no      | yes, own active club      | no                               | no                        |
| Submit event for review                | no      | yes, own active club      | policy-dependent                 | yes                       |
| Approve/reject event                   | no      | no                        | yes, own college                 | yes                       |
| Cancel/complete published event        | no      | yes, own active club      | yes, own college                 | yes                       |
| Approve/reject club                    | no      | no                        | yes, own college                 | yes                       |
| Change user roles                      | no      | no                        | yes, own college, no super admin | yes                       |
| View college audit logs                | no      | no                        | yes, own college                 | yes                       |
| Manage colleges/platform settings      | no      | no                        | no                               | yes                       |
| Resolve duplicate events               | no      | no                        | yes, own college                 | yes                       |

These are product specifications. The authoritative implementation rules remain
in the server services and the database constraints. Prompt 4 supplies a trusted
`AuthenticatedActor` from the verified session; Prompt 5 dashboard routes enforce
role and tenant checks before calling these services. Prompt 6 adds poster
management and authenticated delivery without changing the role model. See
`docs/dashboards.md` for the implemented route map and `docs/event-operations.md`
for the lifecycle, notification, and poster rules.
