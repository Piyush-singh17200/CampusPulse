# Event intelligence

This document describes the Event Intelligence features: local poster OCR, student
recommendations, advisory duplicate review, and schedule-conflict warnings. All
four features are implemented against the existing PostgreSQL data model and
authorization rules. No paid AI, external LLM, recommendation service, or
cloud OCR API is used.

## 1. Local poster OCR

### Processing model

- OCR is an explicit Server Action (`runPosterOcrAction`) after a primary poster
  exists. Manual event creation and editing never wait for OCR.
- The engine is `tesseract.js@7` with the bundled
  `@tesseract.js-data/eng@1.0.0` English traineddata. The worker, WASM, and
  traineddata are loaded from `node_modules`; runtime requests are not sent to
  a third-party OCR service.
- `next.config.ts` lists `tesseract.js` and `@tesseract.js-data/eng` in
  `serverExternalPackages` so the worker and language files keep their package
  paths in production builds.
- OCR is server-only. The service reloads the poster, event, club, and actor
  from the database. The browser supplies only `eventId` and `posterId`.
- Poster access follows the existing poster-management rules: the actor must be
  an active president/officer of the event's active club, and the event must be
  `DRAFT` or `REJECTED`. Published, pending-review, cancelled, and completed
  events cannot run OCR.
- The service reuses the configured poster storage adapter and validates the
  stored image again before passing bytes to Tesseract.

### Status and duplicate-processing safety

`EventPoster.ocrStatus` is one of:

| Status          | Meaning                                                    |
| --------------- | ---------------------------------------------------------- |
| `NOT_REQUESTED` | No OCR attempt has been made.                              |
| `PENDING`       | A request is queued/claimed but has not started.           |
| `PROCESSING`    | The worker is running.                                     |
| `COMPLETED`     | Fields were extracted and are ready for review.            |
| `FAILED`        | Processing failed; the safe error is stored in `ocrError`. |

`ocrStartedAt` and `ocrCompletedAt` record timing. The claim is an atomic
`updateMany` guarded by the current status. A second request while the first is
running returns the current state instead of starting a second worker. A
`PENDING`/`PROCESSING` claim older than the worker deadline plus a safety margin
is recovered as a safe failure, so a crashed process cannot block OCR forever.
The engine deadline covers worker download/startup as well as recognition, and a
worker that appears after timeout is terminated. Failed attempts can be retried.
A retry clears old extracted fields and review state before writing a new set.

Failure handling is deliberately safe: raw worker errors are logged on the
server, but the poster stores a generic user-facing message. The event is never
changed by a failed OCR attempt.

### Extraction and confidence

`src/server/ocr/extract.ts` is deterministic and independent of Tesseract and
the database. It produces one review row per `PosterOcrFieldName`:

`TITLE`, `SUMMARY`, `DESCRIPTION`, `START_DATE`, `START_TIME`, `END_DATE`,
`END_TIME`, `REGISTRATION_DEADLINE_DATE`, `REGISTRATION_DEADLINE_TIME`, `VENUE`,
`VENUE_ADDRESS`, `ORGANIZER`, `CONTACT`, and `CATEGORY`.

Each row stores:

- the suggested `value` (or `null`);
- a nullable `confidence`;
- the poster `evidence` text;
- `extractionStatus`: `EXTRACTED`, `AMBIGUOUS`, `MISSING`, or `INVALID`;
- `requiresReview`;
- review state (`PENDING`, `ACCEPTED`, `REJECTED`), `reviewedValue`, and
  `reviewedAt`.

Confidence is reported only when it comes from Tesseract word confidence for
the exact line used as evidence. Derived date, time, and category values keep
`confidence = null`; the UI must not present an invented confidence score.
Ambiguous numeric dates such as `05/06/2026` and times without a defensible
meridiem are marked `AMBIGUOUS` with `value = null`, not silently interpreted.

### Review and apply

- `PosterOcrPanel` on `/club/events/[eventId]/edit` shows every extracted field,
  its poster evidence, confidence when available, and a per-field decision.
- The organizer can edit an accepted value before saving. `Save OCR review`
  sends the complete decision set to `applyPosterOcrReview`.
- Only `ACCEPT` decisions are applied. `REJECT` discards a suggestion and
  `PENDING` leaves it unapplied.
- The apply path reuses `updateEvent`/`updateEventInTransaction`, so normal
  validation, lifecycle rules, category/interest replacement, audit behavior,
  and authorization remain in force. OCR cannot publish, approve, submit,
  cancel, or bypass review.
- Accepted dates and times are interpreted in the college's IANA timezone from
  `College.timezone` and converted to absolute UTC timestamps. Accepting only a
  time keeps the date from the event's existing value; accepting only a date
  keeps the existing time.
- Accepted categories are added through the existing category relation. An OCR
  category cannot remove existing categories.
- The review is recorded in the audit log as `EVENT_UPDATED` with
  `source: "poster_ocr_review"`, the accepted fields, and the applied event
  fields.

## 2. Personalized recommendations

`src/services/recommendations.ts` reads real database signals for the signed-in
student's college. It does not call an external ranking or LLM service.

### Eligibility

Candidates are:

- in the student's college;
- `PUBLISHED`;
- not deleted;
- owned by an active, non-deleted club;
- starting in the future;
- open for registration (`registrationOpensAt` is null or in the past, and
  `registrationDeadline` is null or in the future);
- not full, where capacity is set;
- not already registered by the student;
- not already saved by the student.

The candidate query is one bounded query with shared event selects. It fetches
candidate signals in bulk and does not issue one query per recommendation.

### Signals and weights

| Signal     | Weight | Source                                                       |
| ---------- | ------ | ------------------------------------------------------------ |
| Interest   | 40%    | Overlap between `StudentInterest` and `EventInterest` tags   |
| Category   | 25%    | The student's category affinity from prior registrations     |
| Timing     | 20%    | Starts within 30 days; sooner is stronger                    |
| Popularity | 15%    | Active registrations (`CONFIRMED` + `ATTENDED`) on the event |

If a signal is unavailable, its weight is redistributed proportionally across
the remaining available signals. The final score is rounded for stable display.
Sorting is deterministic: score descending, then start time ascending, then
event ID. The same data produces the same order.

Explanations are generated from the signals that actually contributed:

- “Matches your interest in …”;
- “Matches …, a category you have explored.”;
- “Registration closes in …”;
- “Happening in the next 7 days.”;
- “Popular among students at your college.”.

The student overview shows the top recommendations and one honest explanation
under each card. If the recommendation query fails, the page falls back to the
existing recent-events list and shows a neutral reason instead of inventing
personalization. If no eligible events exist, the page shows the returned
empty-state reason.

## 3. Duplicate-event review

`src/services/duplicate-events.ts` implements deterministic, same-college,
advisory duplicate detection.

### Scoring

The score combines:

| Signal          | Weight | Details                                              |
| --------------- | ------ | ---------------------------------------------------- |
| Title           | 0.55   | 60% token Jaccard + 40% normalized Levenshtein ratio |
| Same local date | 0.25   | Required; dates compared in the college timezone     |
| Venue           | 0.15   | Token similarity; both online events score 1         |
| Same club       | 0.05   | Both events owned by the same club                   |

The threshold is **0.62**. A match must also pass a guard:

- title similarity is at least 0.72; or
- the events share a local date and venue similarity is at least 0.70 while
  title similarity is at least 0.50.

Same-day scheduling is required. This avoids flagging recurring series or
unrelated events on different days even when titles are similar.

### Storage and lifecycle

- Detection runs after a successful `DRAFT → PENDING_APPROVAL` transition. It
  is advisory and runs after the transition commits; a detection failure is
  logged and never blocks the submission.
- The event is compared with non-deleted `PENDING_APPROVAL`, `PUBLISHED`, and
  `COMPLETED` events in the same college. The event itself is excluded.
- Rows are stored in `EventDuplicate` with `collegeId`, primary/candidate event
  IDs, confidence, human-readable `reasons`, status, reviewer, and timestamps.
  The older event is stored as primary when timestamps differ.
- Re-running detection replaces pending suggestions for that event but preserves
  `CONFIRMED` and `DISMISSED` history. Rejected or cancelled events clear their
  pending suggestions.
- `@@unique([primaryEventId, candidateEventId])` prevents duplicate rows, and
  composite foreign keys keep both events in the review's college.

### Review

- College administrators see pending suggestions on `/college/approvals` and
  on the college event detail page.
- `reviewDuplicateAction` records `CONFIRMED` or `DISMISSED`, the reviewer, and
  an audit entry (`DUPLICATE_CONFIRMED` or `DUPLICATE_DISMISSED`).
- Reviewing is advisory only. Neither action merges, rejects, cancels, deletes,
  or changes the status of either event. The UI states this explicitly.
- Reviews are tenant-scoped: a college administrator from another college and a
  club administrator are rejected.

## 4. Schedule-conflict warnings

`src/services/schedule-conflicts.ts` uses strict interval overlap:

```text
A.start < B.end && B.start < A.end
```

Adjacent events do not conflict. For example, 10:00–12:00 and 12:00–14:00 are
compatible. Incomplete intervals produce a `POTENTIAL` warning instead of a
hard overlap claim.

- Conflict lookup reads the student's active registrations
  (`CONFIRMED`, `ATTENDED`, `NO_SHOW`) in the same college, excludes the target
  event, and ignores cancelled events.
- Warnings are shown on the student event detail page before registration and
  on the student registrations list.
- Registration revalidates conflicts on the server inside the registration
  transaction. The conflict list is written to the
  `REGISTRATION_STATUS_CHANGED` audit metadata and returned to the action/UI.
- The current registration rules have no organizer-approved override, so a
  conflict is advisory and does **not** block an otherwise valid registration.
  The confirmation message explicitly says the place is still reserved.
- Conflict overlap is calculated from absolute `timestamptz` values. Date and
  time display uses the college timezone; OCR wall-clock input is converted
  through `src/lib/timezone.ts`.

## 5. Data model and migration

Event Intelligence adds:

- enums `PosterOcrFieldName`, `PosterOcrExtractionStatus`,
  `PosterOcrReviewStatus`;
- `EventInterest` (`event_interests`) with composite event/college and interest
  foreign keys;
- `PosterOcrField` (`poster_ocr_fields`) with composite poster/college foreign
  keys and a unique `(posterId, field)`;
- `EventPoster.ocrError`, `ocrStartedAt`, `ocrCompletedAt`, and
  `@@unique([id, collegeId])`;
- `EventDuplicate.reasons` and duplicate status indexes.

Migration:
`prisma/migrations/20261113000000_event_intelligence/migration.sql`.

Apply it with:

```powershell
npm run db:migrate:deploy
npx prisma migrate status
```

The test database is migrated by `tests/global-setup.ts` using the same
migration directory.

## 6. Environment and runtime

No new required environment variable was introduced. Existing variables remain:

- `DATABASE_URL` and `DIRECT_URL` for PostgreSQL;
- `TEST_DATABASE_URL` for the isolated `campuspulse_test` database;
- Better Auth and application URL variables documented in
  `docs/authentication.md`.

The English OCR model is bundled as a dependency, so no traineddata download or
`TESSDATA_PREFIX` is required at runtime. The local Tesseract worker needs a
Node.js runtime with the packages installed. Each OCR request creates and
terminates its own worker to isolate failures; there is no long-lived worker
pool or reused worker process.

## 7. Tests

Event Intelligence adds focused service tests:

- `tests/services/ocr-extract.test.ts` — deterministic extraction, confidence,
  ambiguous dates/times, missing fields;
- `tests/services/poster-ocr.test.ts` — review storage, idempotent processing,
  duplicate-processing claim, apply decisions, failure safety;
- `tests/services/recommendations.test.ts` — eligibility exclusions,
  deterministic ranking, real explanations, empty state;
- `tests/services/duplicate-events.test.ts` — scoring, threshold, same-college
  scoping, persistence, confirm/dismiss audit, no automatic event changes,
  submission hook;
- `tests/services/schedule-conflicts.test.ts` — strict overlap, adjacent
  events, incomplete intervals, pre-registration lookup, registration
  revalidation and audit metadata.

Event Intelligence also adds `tests/e2e/event-intelligence.spec.ts`, covering the browser workflow
and responsive screenshots. Event Operations extends the suite to 28 Vitest files / 215
tests and adds the Event operations Playwright workflow.

Run:

```powershell
npm test
npm run test:e2e
```

The full suite was verified with 28 test files / 215 tests passing.

## 8. Limitations

- OCR supports English traineddata only and raster JPEG/PNG/WebP posters. It
  does not read PDFs, handwriting, QR codes, or multilingual posters reliably.
- OCR is user-triggered and runs in the request process. There is no durable
  background queue, progress percentage, or multi-instance worker pool. A long
  OCR request is limited by the server action/request timeout.
- Extracted dates and times are intentionally conservative. Ambiguous values
  remain unapplied until an organizer edits them.
- Recommendations use explicit interests and prior registration categories.
  They do not learn from clicks, dwell time, or external behavior.
- Duplicate detection is lexical and rule-based. It does not understand
  semantics, recurring series, or cross-language titles, and it never
  auto-merges or auto-rejects.
- Schedule conflicts are advisory. There is no blocking override workflow,
  travel-time buffer, or per-student availability calendar.
- Notifications remain in-app only; no email, push, SMS, or background outbox.
- PostgreSQL RLS is still not implemented; tenant isolation is application-layer
  scoping plus composite foreign keys.
- The local poster storage adapter is single-instance development storage. See
  `docs/poster-storage.md`.
