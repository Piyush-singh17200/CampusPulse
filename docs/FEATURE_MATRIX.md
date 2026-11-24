# CampusPulse Feature Matrix

**Phase:** Final Production Release & Verification  
**Last verified:** 22 November 2026  
**Verification environment:** local Next.js 16 development server, PostgreSQL 17 in Docker on `localhost:5434`, Chromium via Playwright.

## Status legend

| Status          | Meaning                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------- |
| **Verified**    | Exercised against the local database and UI in this phase, or covered by the passing automated suite. |
| **Implemented** | Code and UI exist and pass static checks; the specific external service was not available locally.    |
| **Deferred**    | Explicitly outside this submission's scope.                                                           |

## Public and account surfaces

| Capability                                                                             | Route or surface                      | Data and authorization                                                                          | Evidence                                                | Status                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------- |
| Editorial landing page with the required "Too Many Posters, Too Little Signal" message | `/`                                   | Static product content plus clearly labelled illustrative preview data; no database claim       | Showcase screenshots 01-02; browser audit               | **Verified**                                 |
| Interactive Student / Club / College / Platform product preview                        | `/` hero                              | Client-side role switcher; illustrative data only, labelled in the UI                           | Production Release screenshot 01; keyboard review       | **Verified**                                 |
| Sign in                                                                                | `/login`                              | Better Auth email/password, database session, generic errors, rate limiting, CSRF/origin checks | Screenshot 03; `tests/auth/*`; Hardening E2E            | **Verified**                                 |
| Student registration                                                                   | `/register`                           | Validated server action; role and college are server-derived                                    | `tests/auth/registration.test.ts`                       | **Verified**                                 |
| Password recovery                                                                      | `/forgot-password`, `/reset-password` | Hash-only, single-use, 30-minute reset tokens; SMTP optional                                    | `tests/auth/password-reset.test.ts`                     | **Verified** (SMTP delivery **Implemented**) |
| Account home and logout                                                                | `/account`                            | Session-backed actor; redirects by role                                                         | Auth tests and browser audit                            | **Verified**                                 |
| Disabled / unauthorized states                                                         | `/account-disabled`, `/unauthorized`  | Safe, non-enumerating messages                                                                  | Browser audit                                           | **Verified**                                 |
| Responsive navigation and skip link                                                    | All surfaces                          | Keyboard-operable mobile drawer, focus return, scroll lock, skip-to-content                     | Accessibility report; Production Release viewport audit | **Verified**                                 |

## Student workspace

| Capability                          | Route or surface                                                       | Data and authorization                                                                       | Evidence                             | Status       |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------ | ------------ |
| Personal overview                   | `/student`                                                             | Real registrations, saved events, recommendations, notifications, interests                  | Screenshot 04; 360/390/1280 captures | **Verified** |
| Discover published events           | `/student/discover`                                                    | Tenant-scoped published events from active clubs; search, category, date filters, pagination | Screenshot 05; `tests/dashboards/*`  | **Verified** |
| Event detail and registration       | `/student/events/[eventId]`                                            | Published event visibility; server-side deadline, capacity, duplicate, and conflict checks   | Screenshot 06; registration tests    | **Verified** |
| Cancel registration                 | Event detail / My events                                               | Own confirmed registration only; cancellation notification and audit in one transaction      | Registration tests                   | **Verified** |
| Save / unsave events                | Event cards and detail                                                 | Private saved list, tenant-scoped, idempotent                                                | Saved-event tests                    | **Verified** |
| My events                           | `/student/registrations`                                               | Upcoming and past registrations, status counts, attendance QR links                          | Browser route audit                  | **Verified** |
| Saved events                        | `/student/saved`                                                       | Private shortlist; empty state and discovery link                                            | Browser route audit                  | **Verified** |
| Calendar and ICS downloads          | `/student/calendar`; `/api/calendar/registered`, `/api/calendar/saved` | Authenticated, tenant-scoped, capped at 1,000 events, row-count/truncation headers           | Screenshot 19; ICS tests             | **Verified** |
| Attendance QR                       | `/student/registrations/[registrationId]/attendance`                   | Own registration only; signed event-bound credential                                         | Attendance tests; Operations E2E     | **Verified** |
| Event feedback                      | `/student/feedback`                                                    | Attended completed events only; 30-day window                                                | Feedback tests; Operations E2E       | **Verified** |
| Notification center and preferences | `/student/notifications`                                               | Own notifications only; unread/type filters, pagination, safe deep links                     | Notification tests; Operations E2E   | **Verified** |
| Profile and interests               | `/student/profile`                                                     | Own profile within own college; validated fields and interests                               | Profile/dashboard tests              | **Verified** |

## Club administrator workspace

| Capability                       | Route or surface                           | Data and authorization                                                                            | Evidence                                | Status                       |
| -------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------- |
| Operations overview              | `/club`                                    | Managed active club only; drafts, pending submissions, next published event, registrations        | Screenshot 08; 390 capture              | **Verified**                 |
| Event lifecycle                  | `/club/events`, `/club/events/[eventId]`   | Club-scoped draft, submit, edit, cancel, complete; server-side transition guards                  | Screenshot 09; lifecycle tests          | **Verified**                 |
| Create event                     | `/club/events/create`                      | Server-validated fields, registration window, capacity, online/venue rules                        | Browser route audit                     | **Verified**                 |
| Poster upload / replace / remove | Event workspace; `/api/posters/[posterId]` | Content-validated JPEG/PNG/WebP, 4.2 MB and dimension limits, private delivery                    | Poster tests; Posters E2E               | **Verified** (local storage) |
| Poster OCR with human review     | Event workspace                            | Explicit request, local Tesseract.js, 2 active / 8 queued / 20 s guard, field-by-field acceptance | OCR tests; Intelligence E2E             | **Verified**                 |
| Registrations list               | `/club/registrations`                      | Own club events only; filters, pagination, tenant-scoped rows                                     | Browser route audit; registration tests | **Verified**                 |
| Attendance                       | `/club/attendance`                         | Own club event only; QR scanner/manual token, reasoned corrections, audit                         | Screenshot 10; attendance tests         | **Verified**                 |
| Feedback review                  | `/club/feedback`                           | Read-only feedback for own club's attended events                                                 | Browser route audit; feedback tests     | **Verified**                 |
| Analytics                        | `/club/analytics`                          | Database-derived event, registration, attendance, rating, and category breakdowns                 | Screenshot 11; analytics tests          | **Verified**                 |
| Attendance CSV                   | `/api/exports/club/attendance`             | Authorized club manager; formula-injection protection; audit                                      | Export tests; Operations E2E            | **Verified**                 |
| Club profile settings            | `/club/settings`                           | Active club profile fields; club-scoped manager authorization                                     | Browser route audit                     | **Verified**                 |

## College administrator workspace

| Capability            | Route or surface                 | Data and authorization                                                                  | Evidence                          | Status       |
| --------------------- | -------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------- | ------------ |
| College overview      | `/college`                       | Own college only; approval queue, club applications, event status, audit activity       | Screenshot 13; 768 capture        | **Verified** |
| Event approvals       | `/college/approvals`             | Own college; approve/reject with required reason; transactional notifications and audit | Screenshot 14; lifecycle tests    | **Verified** |
| Club applications     | `/college/clubs`                 | Own college; approve/reject with reason                                                 | Club tests; browser audit         | **Verified** |
| Duplicate review      | `/college/approvals`             | Advisory same-college suggestions; confirm/dismiss never mutates the events             | Duplicate tests; Intelligence E2E | **Verified** |
| All college events    | `/college/events`                | Read-only tenant-scoped event view with detail pages                                    | Browser route audit               | **Verified** |
| People and roles      | `/college/users`                 | Own-college users; constrained role changes, self-escalation guard, session revocation  | User/role tests                   | **Verified** |
| Feedback moderation   | `/college/feedback`              | Own college; hide/restore while preserving original response and audit                  | Feedback tests; Operations E2E    | **Verified** |
| Analytics             | `/college/analytics`             | Own college; date/event/club/category/status filters and CSV                            | Analytics tests                   | **Verified** |
| Audit log             | `/college/audit-logs`            | Own college; paginated, redacted administrative history                                 | Browser route audit               | **Verified** |
| College settings      | `/college/settings`              | Own college; validated profile fields                                                   | Browser route audit               | **Verified** |
| College analytics CSV | `/api/exports/college/analytics` | Authorized college administrator; tenant-scoped; audit                                  | Export tests                      | **Verified** |

## Platform administrator workspace

| Capability               | Route or surface                  | Data and authorization                                                                       | Evidence                     | Status       |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------- | ------------ |
| Network overview         | `/platform`                       | Cross-tenant read model; tenant coverage, content pipeline, governance trail, network health | Screenshot 16; 1024 capture  | **Verified** |
| College lifecycle        | `/platform/colleges`              | Super-admin only; create/suspend/archive with audit                                          | College tests; browser audit | **Verified** |
| Users and tenant context | `/platform/users`                 | Super-admin only; constrained role/status changes with session revocation                    | User tests                   | **Verified** |
| Network analytics        | `/platform/analytics`             | Cross-tenant aggregates with filters and explicit 5,000-row breakdown cap                    | Analytics tests              | **Verified** |
| Global audit history     | `/platform/audit-logs`            | Super-admin only; redacted, paginated audit trail                                            | Screenshot 17                | **Verified** |
| Platform settings        | `/platform/settings`              | Storage driver, email state, environment/health information; no secrets printed              | Screenshot 20                | **Verified** |
| Platform analytics CSV   | `/api/exports/platform/analytics` | Super-admin only; tenant context retained; audit                                             | Export tests                 | **Verified** |

## Shared system capabilities

| Capability                     | Implementation                                                                                               | Evidence                                               | Status                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------- |
| Multi-tenant PostgreSQL schema | 27 Prisma models, composite tenant foreign keys, eight applied migrations                                    | `npx prisma validate`; migration status                | **Verified**                                   |
| Trusted-actor RBAC             | Session reloads role, college, and club memberships from PostgreSQL; browser payload never supplies identity | Authorization and RBAC tests                           | **Verified**                                   |
| CSRF / origin checks           | Same-origin and `Sec-Fetch-Site` validation on mutations                                                     | CSRF tests                                             | **Verified**                                   |
| Rate limiting                  | PostgreSQL fixed-window limiter with HMAC lookup keys                                                        | Rate-limit tests                                       | **Verified**                                   |
| Proxy-aware client IP          | Opt-in `TRUST_PROXY_HEADERS`; right-side `x-forwarded-for` hop selection; defaults to `unknown`              | Environment/schema tests; docs                         | **Verified**                                   |
| Audit trail                    | Redacted, append-only application writes for admin, export, attendance, poster, and auth events              | Audit tests                                            | **Verified**                                   |
| Health endpoint                | `/api/health` with bounded database check and no secret output                                               | Health tests; Hardening E2E                            | **Verified**                                   |
| CSV exports                    | UTF-8 BOM, CRLF, formula-injection protection, tenant scoping, row caps, audit                               | Export tests; Operations E2E                           | **Verified**                                   |
| ICS exports                    | Authenticated single/registered/saved downloads, 1,000-event cap, truncation headers                         | ICS tests                                              | **Verified**                                   |
| OCR concurrency                | Per-process 2 active / 8 queued / 20 s wait, safe `429`                                                      | OCR tests; source review                               | **Verified** (per process)                     |
| Storage                        | Local filesystem adapter; S3-compatible adapter implemented                                                  | Storage tests                                          | **Implemented** (S3 live verification pending) |
| Email                          | SMTP password-reset path implemented                                                                         | Email tests                                            | **Implemented** (live delivery pending)        |
| Responsive UI                  | 360, 390, 768, 1024, 1280, 1440 px captured and audited                                                      | Showcase screenshot report                             | **Verified**                                   |
| Accessibility                  | Skip link, labels, focus management, reduced-motion respect, contrast review                                 | Accessibility report; Production Release browser audit | **Verified**                                   |
| Fictional demo seed            | Guarded, idempotent, development-only, upserts colleges/users/clubs/events/registrations/notifications       | Seed run; `prisma/seed.ts`                             | **Verified**                                   |

## Deliberately deferred

- Public business APIs and unauthenticated business endpoints.
- Production deployment, DNS, TLS, SMTP domain setup, and secret-manager integration.
- Live S3 verification, CDN delivery, malware scanning, and multi-instance storage testing.
- Two-way calendar sync and reminder delivery.
- Email, push, or SMS notification delivery.
- Semantic duplicate detection or external recommendation/LLM services.
- PostgreSQL row-level security (RLS); tenant isolation remains application-layer plus composite foreign keys.
- Load testing, restore drill, and penetration test.
