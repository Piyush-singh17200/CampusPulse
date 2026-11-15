# Event operations

This document is the operational reference for the event lifecycle, poster
management, notifications, audit, registration interactions, and the Prompt 7
event-intelligence features. It describes the behavior implemented in the
repository; it is not a claim that every future operational feature exists.
See `docs/event-intelligence.md` for OCR, recommendation, duplicate-threshold,
and schedule-conflict details.

## 1. Roles and ownership

| Role            | Event operations                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `CLUB_ADMIN`    | Create, edit, submit, cancel, complete, manage posters, and run OCR for owned active clubs.                  |
| `COLLEGE_ADMIN` | Review events, approve/reject/cancel/complete, and review duplicate suggestions in the same college.         |
| `SUPER_ADMIN`   | Review and transition existing events across colleges; view posters.                                         |
| `STUDENT`       | View published same-college events, register/cancel, save/unsave, see recommendations and schedule warnings. |

Every mutation accepts a trusted `AuthenticatedActor`; the browser never supplies
its user ID, role, college, or club membership. Services reload authorization
state from PostgreSQL before acting. Composite tenant foreign keys add a second
layer of relationship integrity, but they do not replace service authorization.

## 2. Lifecycle transitions

```text
DRAFT -> PENDING_APPROVAL
PENDING_APPROVAL -> PUBLISHED | REJECTED | CANCELLED
REJECTED -> DRAFT
PUBLISHED -> CANCELLED | COMPLETED
CANCELLED, COMPLETED -> terminal
```

| From               | To                 | Actor                          | Reason required | Notes                                       |
| ------------------ | ------------------ | ------------------------------ | --------------- | ------------------------------------------- |
| `DRAFT`            | `PENDING_APPROVAL` | Owning club manager            | no              | Locks poster changes.                       |
| `PENDING_APPROVAL` | `PUBLISHED`        | College/platform administrator | no              | Sets `publishedAt`; notifies club managers. |
| `PENDING_APPROVAL` | `REJECTED`         | College/platform administrator | yes             | Stores reason; notifies club managers.      |
| `PENDING_APPROVAL` | `CANCELLED`        | Owning club manager            | yes             | Club withdrawal before review.              |
| `REJECTED`         | `DRAFT`            | Owning club manager            | no              | Clears rejection fields; edits allowed.     |
| `PUBLISHED`        | `CANCELLED`        | Club or college administrator  | yes             | Cancels confirmed registrations.            |
| `PUBLISHED`        | `COMPLETED`        | Club or college administrator  | no              | Terminal; no new registrations.             |

Invalid transitions, stale concurrent transitions, cross-college IDs, and
non-owner club managers are rejected. A transition writes its audit row and any
notifications in the same database transaction as the status change.

Submitting a draft to `PENDING_APPROVAL` also starts advisory duplicate
detection after the transition commits. Detection failure is logged and never
blocks the submission. Rejecting or cancelling an event clears its pending
duplicate suggestions; confirmed/dismissed review history is preserved.

There is intentionally no `CANCELLED -> PUBLISHED`, `COMPLETED -> PUBLISHED`, or
`PENDING_APPROVAL -> DRAFT` shortcut. Those would hide history or bypass review.

## 3. Event creation and editing

- Creation is club-manager-only. The event starts as `DRAFT`.
- Draft and rejected events can be edited; published, pending, cancelled, and
  completed events cannot have their event fields edited.
- Editing a rejected event does not automatically resubmit it.
- Submitting a draft moves it to `PENDING_APPROVAL`; the poster becomes locked
  for review.
- A poster can be attached during creation or added later from the club event
  edit page.
- Event creation and poster upload are separate operations. If the draft is
  created but the poster upload fails, the draft remains and the browser is
  redirected to the edit page with a safe poster error.
- Event forms can attach multiple existing categories and interests. These
  replaceable links are validated against the same college.
- Draft and rejected events with a primary poster can run local poster OCR. OCR
  only suggests values; accepted fields go through the normal event update path.
  OCR never submits, approves, publishes, or bypasses review.
- Creating an event writes `EVENT_CREATED`; draft/rejected edits write
  `EVENT_UPDATED`.

## 4. Poster management rules

| Event status       | Upload | Replace | Remove | Who                                   |
| ------------------ | ------ | ------- | ------ | ------------------------------------- |
| `DRAFT`            | yes    | yes     | yes    | Active owning-club president/officer  |
| `REJECTED`         | yes    | yes     | yes    | Active owning-club president/officer  |
| `PUBLISHED`        | yes    | yes     | yes    | Active owning-club president/officer  |
| `PENDING_APPROVAL` | no     | no      | no     | Locked for review                     |
| `CANCELLED`        | no     | no      | no     | Terminal; poster retained for history |
| `COMPLETED`        | no     | no      | no     | Terminal; poster retained for history |

- One primary poster is allowed per event. Uploading a new file replaces the
  primary row and generates a new asset URL.
- Replacing a poster deletes the previous row in the same transaction and then
  removes the old file only if no poster row still references it.
- Removing a poster is idempotent when no primary row exists; it does not write
  an audit row in that case.
- Alt text defaults to the event title when omitted and is capped at 300
  characters.
- Poster files are validated by content, not by the browser-provided filename
  or MIME type. See `docs/poster-storage.md`.
- Published posters follow event visibility. Unpublished posters are limited to
  the owning club manager, same-college college administrators, and platform
  administrators.

## 5. Notification matrix

Notifications are in-app `Notification` rows only. SMTP and email delivery are
not configured; no email is sent.

| Trigger                | Recipients                                              | Type                  | Title                  | Transaction boundary |
| ---------------------- | ------------------------------------------------------- | --------------------- | ---------------------- | -------------------- |
| Event approved         | Active presidents/officers of the owning club           | `MODERATION_UPDATE`   | Event approved         | Same transaction     |
| Event rejected         | Active presidents/officers of the owning club           | `MODERATION_UPDATE`   | Event needs changes    | Same transaction     |
| Event cancelled        | Students with `CONFIRMED` registrations at cancellation | `REGISTRATION_UPDATE` | Event cancelled        | Same transaction     |
| Registration confirmed | The registering student                                 | `REGISTRATION_UPDATE` | Registration confirmed | Same transaction     |
| Registration cancelled | The cancelling student                                  | `REGISTRATION_UPDATE` | Registration cancelled | Same transaction     |

- Rejection and cancellation bodies include the stored reason.
- Event cancellation also changes all confirmed registrations to `CANCELLED` in
  the same transaction, so a notification cannot claim a cancellation that was
  rolled back.
- Active manager lookup requires an active membership, role `PRESIDENT` or
  `OFFICER`, and an active, non-deleted user in the same college.
- Students only receive notifications for their own registrations; recipients
  are derived from the transaction, not from browser input.
- There is no separate “event details changed” notification because published
  event fields are not editable in this phase. The only post-publication event
  change is cancellation, which is covered above.
- Retries do not create duplicates: transitions are guarded by the current
  state. For example, a second approval attempt from `PUBLISHED` fails before
  notification creation. A cancelled registration can be re-registered
  intentionally, which creates a new confirmation notification.
- There is no dedupe column or outbox table. Idempotency is state-based, and
  notification inserts share the business transaction.

## 6. Audit actions

| Action                        | Trigger                                                          |
| ----------------------------- | ---------------------------------------------------------------- |
| `EVENT_CREATED`               | Draft creation                                                   |
| `EVENT_UPDATED`               | Draft or rejected event edit                                     |
| `EVENT_APPROVED`              | Transition to `PUBLISHED`                                        |
| `EVENT_REJECTED`              | Transition to `REJECTED`                                         |
| `EVENT_CANCELLED`             | Transition to `CANCELLED`                                        |
| `EVENT_STATUS_CHANGED`        | Other lifecycle transitions                                      |
| `POSTER_UPLOADED`             | First primary poster upload                                      |
| `POSTER_REPLACED`             | Replacement of an existing primary poster                        |
| `POSTER_REMOVED`              | Removal of an existing primary poster                            |
| `REGISTRATION_STATUS_CHANGED` | Registration confirmation, cancellation, attendance, no-show     |
| `DUPLICATE_CONFIRMED`         | College administrator confirms an advisory duplicate suggestion  |
| `DUPLICATE_DISMISSED`         | College administrator dismisses an advisory duplicate suggestion |

OCR applies accepted fields through `EVENT_UPDATED` with
`source: "poster_ocr_review"` and the accepted/applied field lists. Duplicate
review metadata records both event IDs, confidence, reasons, the decision, and
`automaticEventChange: false`. Registration audit metadata includes the
revalidated schedule conflicts and `scheduleConflictCount`.

Poster audit metadata includes the event, club, previous poster ID when
replacing, detected MIME type, byte size, width, and height. Audit rows are
written in the same transaction as the business change and metadata is redacted
for secrets, tokens, cookies, passwords, and similar sensitive values. There is
no application service to edit or delete audit rows.

## 7. Registration interactions

- Registration is available only for `PUBLISHED`, non-deleted events whose club
  is active.
- The event must not have started, the registration window must be open, and the
  deadline must not have passed.
- Capacity is enforced under an event-row lock. Active places count `CONFIRMED`
  and `ATTENDED` registrations.
- `@@unique([eventId, studentProfileId])` prevents duplicate rows. A cancelled
  registration can be reactivated.
- Confirmation and cancellation each write a registration notification and an
  audit row in the same transaction.
- Event cancellation cancels confirmed registrations and notifies those
  students. It does not delete registration history.
- Event completion is terminal and does not cancel registrations.
- Schedule conflicts use strict overlap (`A.start < B.end && B.start < A.end`).
  Adjacent events do not conflict. Conflicts are revalidated inside the
  registration transaction, recorded in audit metadata, returned to the UI, and
  shown as advisory warnings. They do not block an otherwise valid
  registration.

## 8. Access-control checks

Before publishing or changing a poster, verify:

1. The actor is an active club president/officer for the event's club.
2. The event belongs to the actor's college and the club is active.
3. The event status allows the operation.
4. The poster file passes content validation and the size/dimension limits.
5. The resulting poster URL is not readable by an unauthenticated browser or a
   student from another college.
6. A draft poster is not readable by a same-college student.
7. A published poster is readable by a same-college student while the event is
   published and the club is active.

## 9. Operational checklist

### Before submission

- Confirm title, summary, description, dates, registration window, venue,
  capacity, categories, and interests.
- Upload a JPEG, PNG, or WebP no larger than 5 MB.
- Set meaningful alt text.
- Confirm the preview and current-poster display.
- Optionally run OCR, review every suggestion, edit accepted values, and save
  only the fields you want. Confirm ambiguous dates/times were not silently
  applied.
- Save as draft and verify the event detail page.

### Review and publication

- Submit for approval; confirm poster changes are locked.
- As a college administrator, review the event and poster.
- Review any duplicate suggestions. Confirm or dismiss them; neither action
  merges, rejects, cancels, or deletes an event.
- Approve or reject with a clear reason.
- Confirm the club manager receives the in-app notification.
- Confirm a same-college student can see a published poster.
- Confirm a student from another college cannot see the event or poster.

### Registration

- Register a student and confirm the in-app confirmation notification.
- Confirm the club registration list shows the student as confirmed.
- Confirm overlapping registrations show an advisory schedule warning and that
  adjacent events do not.
- Cancel the registration and confirm the cancellation notification.
- Verify capacity and deadline enforcement with a controlled test event.

### Poster replacement and removal

- Replace a published poster and confirm the new URL serves the new bytes.
- Confirm the old URL returns `404`.
- Confirm the old file is removed only when unreferenced.
- Remove the poster and confirm the student-facing fallback.
- Confirm the removed URL returns `404`.
- Check the audit log for `POSTER_REPLACED` or `POSTER_REMOVED`.

### Cancellation and completion

- Cancel with a reason and confirm confirmed students receive the cancellation
  notification.
- Confirm registrations become `CANCELLED` and the event is terminal.
- Mark a published event completed and confirm no further registration or
  poster changes are allowed.

## 10. Verification and limitations

Prompt 6 tests cover lifecycle integration, poster validation, replacement and
removal, storage failure, access control, capacity/deadline enforcement,
duplicate/concurrent registration, notification scoping, audit correctness, and
cross-tenant authorization. Prompt 7 adds service tests for deterministic OCR
extraction, OCR processing/claim/apply/failure, recommendations, duplicate
scoring/review, and schedule conflicts. The Prompt 6 Playwright workflow covers
create → preview → submit → approve → student view → register → club view →
cancel → replace → access-control checks → remove → responsive screenshots.
The Prompt 7 Playwright workflow covers OCR review, recommendations, duplicate
review, schedule warnings, and responsive layouts.

Known limitations:

- Notifications are in-app only; no email, push, SMS, or background delivery.
- OCR supports bundled English raster text only and runs in the request process;
  there is no durable queue or progress percentage.
- Duplicate detection is lexical and advisory; it never auto-merges, auto-
  rejects, or deletes events.
- Schedule conflicts are advisory; there is no blocking override or travel-time
  buffer.
- Recommendations use explicit interests and prior registration categories, not
  click behavior or external services.
- No published-event field editing, so no “event changed” notification beyond
  cancellation.
- No PostgreSQL RLS; tenant isolation is application-layer plus composite keys.
- The local poster adapter is single-instance development storage. See
  `docs/poster-storage.md` for production caveats.
- There is no background orphan-file reaper or notification outbox.
