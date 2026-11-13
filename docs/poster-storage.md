# Poster storage and delivery

Prompt 6 adds one primary poster per event. The feature is deliberately small:
content-validated JPEG, PNG, and WebP files, a server-only storage interface, a
local filesystem adapter for development, and an authenticated delivery route.
It is not a general-purpose media library, an image-processing pipeline, or a
production object-storage integration.

## 1. Scope

Implemented:

- Optional poster during event creation, with a client-side preview.
- Upload, replacement, and removal from the club event edit page.
- JPEG, PNG, and WebP only; 5 MB maximum; dimensions capped at 12,000 px per
  side and 40,000,000 pixels total.
- Server-generated storage keys and content-based validation. Browser MIME type
  and filename are not trusted.
- One primary poster per event, with the previous asset cleaned up after the
  database transaction commits.
- Authenticated, tenant-aware delivery through `GET /api/posters/[posterId]`.
- Poster metadata, alt text, dimensions, and audit entries in PostgreSQL.
- Safe fallback UI when a poster is missing, removed, or fails to load.

Not implemented:

- OCR, text extraction, or automatic field mapping. `ocrStatus` remains
  `NOT_REQUESTED`.
- Image re-encoding, thumbnailing, cropping, focal-point editing, or CDN
  transformation.
- Virus scanning or a malware-detection service.
- Cloud object storage, signed URLs, or multi-instance shared storage.
- Public or unauthenticated poster URLs.

## 2. Storage interface

`src/server/storage/poster-storage.ts` defines the server-only interface:

```ts
export interface PosterStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}
```

Callers pass a generated **storage key**, never a filesystem path. The local
adapter:

- Resolves the configured root and rejects keys outside it.
- Accepts only keys matching
  `UUID.(jpg|png|webp)`, case-insensitively.
- Writes to a random `.upload-*.tmp` file with `mode: 0o600`, then atomically
  renames it into place.
- Refuses to overwrite an existing key.
- Treats a missing file as `null` on read and as a no-op on delete.
- Converts unexpected filesystem failures to the generic `STORAGE_ERROR` domain
  error so paths and adapter details never reach the browser.

The adapter is selected at call time by `getPosterStorage()`. Tests inject a
fake `PosterStorage` to exercise storage failures and cleanup without touching
the real filesystem.

### Configuration

| Variable             | Required | Purpose                                                                                               |
| -------------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `POSTER_STORAGE_DIR` | no       | Absolute or relative local storage root. Defaults to `.data/posters` under the app working directory. |

The default directory is created on first upload and is ignored by Git through
`.data/`. The directory is not inside `public/`; files are never served
directly by the web server.

## 3. Validation pipeline

`src/server/posters/image.ts` validates the actual bytes before anything is
written to storage.

1. Reject empty files.
2. Reject files larger than 5 MB.
3. Identify the format from its signature:
   - PNG: `89 50 4E 47 0D 0A 1A 0A`.
   - JPEG: `FF D8 FF`.
   - WebP: `RIFF` + `WEBP`.
4. Parse the container to obtain width and height:
   - PNG walks chunks, verifies CRCs, requires a valid `IHDR` and `IEND`, and
     rejects trailing data.
   - JPEG walks markers, requires a start-of-frame and a scan, and requires the
     file to end with `FF D9`.
   - WebP supports `VP8X`, `VP8 `, and `VP8L` and validates the RIFF size.
5. Reject zero, oversized, or over-pixel dimensions.
6. Return the detected MIME type, extension, dimensions, and byte size.

SVG, HTML, executables, malformed containers, unsupported formats, and files
whose bytes do not match a supported signature are rejected with a safe
validation error. A valid image with a misleading filename or MIME type is
stored according to its **detected** format.

## 4. Upload, replacement, and removal

### Upload

`uploadEventPoster(actor, input, storage?)`:

1. Re-checks the active account and owning active club manager.
2. Allows management only for `DRAFT`, `REJECTED`, and `PUBLISHED` events.
3. Validates the image content.
4. Generates a new UUID-based key and writes the file.
5. Opens a database transaction, re-loads the event, and re-checks
   authorization and status.
6. Deletes the existing primary poster row, if any, and creates the new primary
   row with metadata and alt text.
7. Writes `POSTER_UPLOADED` or `POSTER_REPLACED` audit metadata in the same
   transaction.
8. After commit, deletes the previous file only if no poster row still
   references it.

If the transaction fails, the newly written file is deleted. If the old-file
cleanup fails, the old row is already gone; the result is an orphan file, not a
broken poster reference.

### Removal

`removeEventPoster(actor, input, storage?)` re-checks the same authorization
and status rules, deletes the primary row in a transaction, writes
`POSTER_REMOVED`, and deletes the file after commit only if it is unreferenced.
Removing an already-absent poster is a no-op and does not write an audit row.

### Status lock

| Event status       | Poster upload/replace/remove |
| ------------------ | ---------------------------- |
| `DRAFT`            | allowed                      |
| `REJECTED`         | allowed                      |
| `PUBLISHED`        | allowed                      |
| `PENDING_APPROVAL` | locked                       |
| `CANCELLED`        | locked                       |
| `COMPLETED`        | locked                       |

Only an active `CLUB_ADMIN` who is a president or officer of the event's club
can manage its poster. College administrators and platform administrators can
review posters but cannot upload, replace, or remove them.

## 5. Delivery and access control

`GET /api/posters/[posterId]` is a dynamic, Node.js route. It never exposes a
filesystem path and always returns one of:

- `401` for an unauthenticated request.
- `404` for a missing, deleted, cross-tenant, unpublished-but-not-authorized,
  unsupported, or storage-missing poster.
- `500` for an unexpected delivery failure, with a generic body.
- `200` with the image bytes for an authorized request.

Successful responses include:

```text
Cache-Control: private, no-store
X-Content-Type-Options: nosniff
Cross-Origin-Resource-Policy: same-origin
Vary: Cookie
Content-Type: image/jpeg | image/png | image/webp
Content-Disposition: inline; filename="poster-<id>.<ext>"
```

Authorization matrix:

| Viewer                                 | Draft/Rejected poster | Published poster | Cancelled/Completed poster |
| -------------------------------------- | --------------------- | ---------------- | -------------------------- |
| Unauthenticated                        | 401                   | 401              | 401                        |
| Same-college student                   | 404                   | allowed          | 404                        |
| Owning-club active manager             | allowed               | allowed          | allowed                    |
| Other-club manager in the same college | 404                   | allowed          | 404                        |
| Same-college college administrator     | allowed               | allowed          | allowed                    |
| Platform administrator                 | allowed               | allowed          | allowed                    |
| Student or staff from another college  | 404                   | 404              | 404                        |
| Deleted event or inactive/deleted club | 404                   | 404              | 404                        |

Published posters are visible to authenticated same-college users while the
event is published and the club is active. The route uses `404` rather than
`403` for unauthorized posters so it cannot be used to enumerate private
assets.

## 6. UI behavior

- `PosterField` validates file type and size in the browser, shows a local
  `blob:` preview, supports clearing the selection, and displays a broken-image
  fallback.
- `PosterManager` shows the current poster, a preview of the selected
  replacement, alt-text input, replace/remove actions, and status messages.
- `PosterImage` renders a safe fallback with an accessible label if the image
  fails to load.
- Student, club, and college event detail pages show the primary poster.
- The club edit page shows a “Manage poster” path for published events while
  keeping event fields read-only.

The browser preview is not a security control. The server repeats all
validation and authorization checks.

## 7. Failure and cleanup semantics

| Failure                                   | Result                                                                  |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| Invalid file content                      | `INVALID_INPUT`; no file written, no row created.                       |
| Storage write fails                       | `STORAGE_ERROR`; no row created.                                        |
| Database transaction fails after write    | Newly written file is deleted; no poster row.                           |
| Previous-file deletion fails after commit | Old row is gone; old file may remain as an orphan.                      |
| Poster row exists but file is missing     | Delivery returns `404`; event and row remain.                           |
| Event deleted                             | Poster row cascades with the event; delivery returns `404`.             |
| Concurrent replacement                    | Each request writes its own key; the transaction determines the winner. |

There is no background garbage collector in Prompt 6. Operators should monitor
for orphan files if filesystem cleanup fails. A production adapter should
provide durable storage, lifecycle rules, and a reconciliation job.

## 8. Production caveats

The local adapter is suitable for development and a single self-hosted
instance. It is **not** production-ready cloud storage:

- Local files are not shared across multiple app instances or containers.
- Ephemeral deployment filesystems lose uploads on restart.
- There is no CDN, signed URL, encryption-at-rest guarantee, or lifecycle
  policy.
- The app process needs a writable directory that is not publicly served.
- Backups must include both PostgreSQL and the poster storage root.
- The default `.data/posters` location must be replaced with a managed volume or
  a future `PosterStorage` adapter for production.

Do not expose the storage directory through a static file server. Do not add a
public route that bypasses `getEventPosterForActor`.

## 9. Tests

Prompt 6 coverage includes:

- `tests/services/poster-validation.test.ts`: valid PNG/JPEG/WebP, oversized
  files, empty files, malformed containers, SVG/HTML/executable rejection, and
  dimension limits.
- `tests/services/poster-storage.test.ts`: key validation, path traversal,
  duplicate-key rejection, missing-file behavior, and safe deletion.
- `tests/services/posters.test.ts`: upload, replacement, removal, access
  control, storage failure, database rollback cleanup, and unreferenced-file
  cleanup.
- `tests/e2e/prompt-6.spec.ts`: create with preview, draft access denial,
  submit/approve, student visibility, registration notification, cancellation,
  replacement, old-URL revocation, cross-college denial, removal, and responsive
  layouts.

See `docs/event-operations.md` for the lifecycle, notification, and audit
matrix.
