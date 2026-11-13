# Event operations

This document is the operational reference for Prompt 6 event lifecycle,
poster management, notifications, audit, and registration interactions. It
describes the behavior implemented in the repository; it is not a claim that
every future operational feature exists.

## 1. Roles and ownership

| Role            | Event operations                                                                      |
| --------------- | ------------------------------------------------------------------------------------- |
| `CLUB_ADMIN`    | Create, edit, submit, cancel, complete, and manage posters for an owned active club.  |
| `COLLEGE_ADMIN` | Review, approve, reject, cancel, and complete events in the same college.             |
| `SUPER_ADMIN`   | Review and transition existing events across colleges; view posters.                  |
| `STUDENT`       | View published same-college events, register/cancel, save/unsave, read notifications. |

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

| Action                        | Trigger                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `EVENT_CREATED`               | Draft creation                                               |
| `EVENT_UPDATED`               | Draft or rejected event edit                                 |
| `EVENT_APPROVED`              | Transition to `PUBLISHED`                                    |
| `EVENT_REJECTED`              | Transition to `REJECTED`                                     |
| `EVENT_CANCELLED`             | Transition to `CANCELLED`                                    |
| `EVENT_STATUS_CHANGED`        | Other lifecycle transitions                                  |
| `POSTER_UPLOADED`             | First primary poster upload                                  |
| `POSTER_REPLACED`             | Replacement of an existing primary poster                    |
| `POSTER_REMOVED`              | Removal of an existing primary poster                        |
| `REGISTRATION_STATUS_CHANGED` | Registration confirmation, cancellation, attendance, no-show |

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

- Confirm title, summary, description, dates, registration window, venue, and
  capacity.
- Upload a JPEG, PNG, or WebP no larger than 5 MB.
- Set meaningful alt text.
- Confirm the preview and current-poster display.
- Save as draft and verify the event detail page.

### Review and publication

- Submit for approval; confirm poster changes are locked.
- As a college administrator, review the event and poster.
- Approve or reject with a clear reason.
- Confirm the club manager receives the in-app notification.
- Confirm a same-college student can see a published poster.
- Confirm a student from another college cannot see the event or poster.

### Registration

- Register a student and confirm the in-app confirmation notification.
- Confirm the club registration list shows the student as confirmed.
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
cross-tenant authorization. The Playwright workflow covers create → preview →
submit → approve → student view → register → club view → cancel → replace →
access-control checks → remove → responsive screenshots.

Known limitations:

- Notifications are in-app only; no email, push, SMS, or background delivery.
- No published-event field editing, so no “event changed” notification beyond
  cancellation.
- No OCR, duplicate detection, recommendations, or scheduling intelligence.
- No PostgreSQL RLS; tenant isolation is application-layer plus composite keys.
- The local poster adapter is single-instance development storage. See
  `docs/poster-storage.md` for production caveats.
- There is no background orphan-file reaper or notification outbox.
