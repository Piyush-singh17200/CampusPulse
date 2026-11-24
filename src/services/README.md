# Services

Server-side domain services for CampusPulse. These modules import
`server-only`, use the centralized Prisma client, and enforce tenant isolation
and authorization boundaries.

- `authorization.ts`: loads the actor, role, college, and active club
  memberships from PostgreSQL; provides role/club assertions.
- `events.ts`: event draft creation, draft/rejected edits, explicit lifecycle
  transitions, cancellation cascade, and audit records.
- `registrations.ts`: registration, capacity/deadline/window checks, duplicate
  prevention, safe cancellation, row locking, and audit records.
- `clubs.ts`: college-scoped club approval/rejection with audit.
- `users.ts`: constrained role changes with self-escalation and SUPER_ADMIN
  guards, with audit.
- `validation.ts`: Zod service input validation, date ordering, slugging, and
  domain-error conversion.

Important boundary: `actorUserId` is supplied by a trusted server caller. The
service loads role/college/membership from the database, so a caller cannot
escalate by supplying a browser-provided role or tenant. The session layer binds this
identity to an authenticated session and enforces route-level authorization before
calling any service.
