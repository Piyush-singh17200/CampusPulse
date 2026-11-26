# CampusPulse — Comprehensive Role & Permission Matrix

This document defines the complete authorization policy, route guards, action boundaries, and tenant isolation rules enforced across the CampusPulse platform.

---

## 1. System Roles Overview

CampusPulse implements a strict hierarchical multi-tenant Role-Based Access Control (RBAC) model:

1. **Anonymous Visitor (`PUBLIC`):** Unauthenticated users accessing the marketing landing page, public discovery, and authentication screens.
2. **Student (`STUDENT`):** Verified campus students belonging to an active college tenant. Can discover events, register, generate check-in credentials, export personal calendars, and submit verified feedback.
3. **Club Administrator (`CLUB_ADMIN`):** Student or campus organizer with an active `PRESIDENT` or `OFFICER` membership in one or more student clubs. Manages club profile, drafts and resubmits events, uploads posters, scans attendee QR codes, and tracks club analytics.
4. **College Administrator (`COLLEGE_ADMIN`):** Campus administrative authority. Approves or rejects club events, resolves duplicate event flags, manages college clubs, promotes or demotes users within the college, oversees college audit logs, configures college timezone/name, and can manage event attendance for any college event.
5. **Platform Administrator (`SUPER_ADMIN`):** Global operator. Provisions new college tenants, suspends or archives colleges, revokes tenant sessions, manages platform users, oversees global audit history, and manages all events and attendance platform-wide.

---

## 2. Granular Route Guard & Permission Matrix

| Resource / Capability                                                |  Anonymous   |           STUDENT           |       CLUB_ADMIN       |     COLLEGE_ADMIN      | SUPER_ADMIN  | Enforced By                              |
| :------------------------------------------------------------------- | :----------: | :-------------------------: | :--------------------: | :--------------------: | :----------: | :--------------------------------------- |
| **Public Landing Page** (`/`)                                        |   Allowed    |           Allowed           |        Allowed         |        Allowed         |   Allowed    | None                                     |
| **Authentication Screens** (`/login`, `/register`)                   |   Allowed    |          Redirect           |        Redirect        |        Redirect        |   Redirect   | Auth redirect                            |
| **Account Settings & Security** (`/account`)                         | Denied (401) |           Allowed           |        Allowed         |        Allowed         |   Allowed    | `getCurrentUser`                         |
| **Change Password Action**                                           | Denied (401) |           Allowed           |        Allowed         |        Allowed         |   Allowed    | `changePasswordAction`                   |
| **Revoke Session Action**                                            | Denied (401) |           Allowed           |        Allowed         |        Allowed         |   Allowed    | `revokeSessionAction`                    |
| **Student Workspace** (`/student`)                                   | Denied (302) |           Allowed           |      Denied (302)      |      Denied (302)      | Denied (302) | `requireDashboardRole("STUDENT")`        |
| **Event Discovery** (`/student/discover`)                            | Denied (302) |           Allowed           |      Denied (302)      |      Denied (302)      | Denied (302) | `requireDashboardRole("STUDENT")`        |
| **Register for Event**                                               | Denied (401) |           Allowed           |      Denied (403)      |      Denied (403)      | Denied (403) | `assertStudent`                          |
| **Generate QR Check-in Token**                                       | Denied (401) |       Allowed (Self)        |      Denied (403)      |      Denied (403)      | Denied (403) | `assertStudent` + registration ownership |
| **Personal Calendar ICS Export**                                     | Denied (401) |       Allowed (Self)        |      Denied (403)      |      Denied (403)      | Denied (403) | `assertStudent`                          |
| **Submit Event Feedback**                                            | Denied (401) | Allowed (Verified Attendee) |      Denied (403)      |      Denied (403)      | Denied (403) | `submitFeedback`                         |
| **Club Workspace** (`/club`)                                         | Denied (302) |        Denied (302)         |        Allowed         |      Denied (302)      | Denied (302) | `requireDashboardRole("CLUB_ADMIN")`     |
| **Create Event Draft** (`/club/events/create`)                       | Denied (302) |        Denied (302)         |        Allowed         |      Denied (302)      | Denied (302) | `assertClubDashboard`                    |
| **Upload / OCR Event Poster**                                        | Denied (401) |        Denied (403)         | Allowed (Managed Club) |   Allowed (College)    |   Allowed    | `assertCanManagePosters`                 |
| **Scan Attendee QR Token**                                           | Denied (401) |        Denied (403)         | Allowed (Managed Club) |   Allowed (College)    |   Allowed    | `assertCanManageEventAttendance`         |
| **Manual Attendance Correction**                                     | Denied (401) |        Denied (403)         | Allowed (Managed Club) |   Allowed (College)    |   Allowed    | `assertCanManageEventAttendance`         |
| **Export Club Attendance CSV**                                       | Denied (401) |        Denied (403)         | Allowed (Managed Club) |   Allowed (College)    |   Allowed    | `getClubAttendanceExport`                |
| **College Workspace** (`/college`)                                   | Denied (302) |        Denied (302)         |      Denied (302)      |        Allowed         | Denied (302) | `requireDashboardRole("COLLEGE_ADMIN")`  |
| **Approve / Reject Event**                                           | Denied (401) |        Denied (403)         |      Denied (403)      |   Allowed (College)    |   Allowed    | `transitionEvent`                        |
| **Duplicate Event Review**                                           | Denied (401) |        Denied (403)         |      Denied (403)      |   Allowed (College)    |   Allowed    | `reviewDuplicate`                        |
| **College QR Attendance Roster** (`/college/events/[id]/attendance`) | Denied (302) |        Denied (302)         |      Denied (302)      |        Allowed         |   Allowed    | `requireAnyDashboardRole`                |
| **Manage College Users & Roles**                                     | Denied (401) |        Denied (403)         |      Denied (403)      | Allowed (Same College) |   Allowed    | `changeUserRole`                         |
| **Moderate Feedback Comments**                                       | Denied (401) |        Denied (403)         |      Denied (403)      | Allowed (Same College) |   Allowed    | `moderateFeedback`                       |
| **College Audit Log Inspection**                                     | Denied (302) |        Denied (302)         |      Denied (302)      |   Allowed (College)    |   Allowed    | `assertCollegeDashboard`                 |
| **Platform Workspace** (`/platform`)                                 | Denied (302) |        Denied (302)         |      Denied (302)      |      Denied (302)      |   Allowed    | `requireDashboardRole("SUPER_ADMIN")`    |
| **Provision College Tenant**                                         | Denied (401) |        Denied (403)         |      Denied (403)      |      Denied (403)      |   Allowed    | `assertSuperAdmin`                       |
| **Suspend / Archive College Tenant**                                 | Denied (401) |        Denied (403)         |      Denied (403)      |      Denied (403)      |   Allowed    | `assertSuperAdmin`                       |
| **Platform Audit Logs & Exports**                                    | Denied (401) |        Denied (403)         |      Denied (403)      |      Denied (403)      |   Allowed    | `assertPlatformDashboard`                |

---

## 3. Tenant Isolation Principles

1. **Foreign Key Scoping:** All tenant records (`User`, `StudentProfile`, `Club`, `ClubMembership`, `Event`, `EventRegistration`, `SavedEvent`, `AuditLog`, `Feedback`) carry `collegeId`. Every query unconditionally scopes by `collegeId`.
2. **Context Integrity:** A user's `collegeId` is loaded directly from the database in `loadActorContext` on every authenticated request; it is never read from client parameters or user-supplied form fields.
3. **Super Admin Scope:** Super Admins have `collegeId = null`. When querying, they bypass the tenant filter, allowing platform-wide administration.
4. **Session Invalidation:**
   - Role change revokes all active sessions for the targeted user.
   - College suspension or archiving immediately deletes all active sessions for every user belonging to that college tenant.
   - User suspension or deactivation invalidates the actor context on the very next request via `assertActorActive`.
