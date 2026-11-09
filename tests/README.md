# Tests

The database integration suite uses Vitest and an isolated PostgreSQL database
named exactly `campuspulse_test`. The application, seed, and test suite never
share a database connection URL.

## Safety model

- `TEST_DATABASE_URL` must be present in `.env.local` (or the environment).
- The database name must be exactly `campuspulse_test`.
- The host must be local (`localhost`, `127.0.0.1`, or `::1`).
- `tests/setup.ts` rewrites `DATABASE_URL` to the test URL before importing the
  application client.
- `tests/global-setup.ts` creates the database if needed and runs
  `prisma migrate deploy` against it.
- `tests/helpers/db.ts` checks `current_database()` before truncating tables.
- Tests run sequentially (`fileParallelism: false`, `maxWorkers: 1`).

## Commands

```powershell
npm test
npm run test:watch
npm run test:db
```

## Coverage

- `tests/db/client.test.ts`: initialization, singleton reuse, unsafe database
  refusal, unreachable database handling, tenant context validation.
- `tests/db/relationships.test.ts`: college/user/profile/club/event ownership,
  valid composite relationships, cross-college FK rejection.
- `tests/services/events.test.ts`: valid/invalid/unauthorized transitions,
  approval/rejection/cancellation, event creation/update audit, no audit on a
  failed transition, cancellation cascade.
- `tests/services/registrations.test.ts`: successful registration, duplicate
  rejection, cancelled/completed rejection, capacity, deadline/opening windows,
  invalid cancellation transition, safe cancellation, cross-college rejection,
  non-student rejection, concurrent capacity enforcement, concurrent duplicate
  prevention.
- `tests/services/security.test.ts`: tenant context, cross-tenant transitions,
  student/club-admin authorization, role escalation, cross-college role changes,
  self-role-change prevention, club approval audit, role-change audit, audit
  redaction, transaction rollback.

The tests intentionally fail closed rather than skipping when the test database
is unavailable. Do not run destructive cleanup against a development database.
