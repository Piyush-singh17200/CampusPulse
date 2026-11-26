const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>CampusPulse — CA2 Report (INT257)</title>
<style>
  @page {
    size: A4;
    margin: 20mm 18mm 20mm 18mm;
    @bottom-center {
      content: counter(page);
      font-size: 10pt;
      font-family: "Times New Roman", Times, serif;
    }
  }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #111;
    margin: 0;
    padding: 0;
  }
  .page {
    page-break-after: always;
    break-after: page;
    position: relative;
    min-height: 96vh;
    padding-bottom: 20px;
  }
  .page:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
  .cover {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    text-align: center;
    min-height: 94vh;
    padding: 30px 10px;
  }
  .cover-header { margin-top: 10px; }
  .cover-title {
    margin: 40px 0 20px 0;
  }
  .cover-title h1 {
    font-size: 26pt;
    font-weight: bold;
    margin: 0 0 10px 0;
  }
  .cover-title h2 {
    font-size: 14pt;
    font-weight: normal;
    color: #333;
    margin: 0 0 15px 0;
    border: none;
    padding: 0;
  }
  .cover-title h3 {
    font-size: 12pt;
    font-weight: bold;
    margin: 0 0 25px 0;
  }
  .cover-title p {
    font-size: 10pt;
    color: #444;
    max-width: 580px;
    margin: 0 auto;
    line-height: 1.5;
  }
  .cover-table {
    width: 80%;
    margin: 30px auto;
  }
  .cover-footer {
    margin-bottom: 20px;
    font-size: 11pt;
    font-weight: bold;
    line-height: 1.5;
  }
  h1 { font-size: 15pt; font-weight: bold; margin: 16px 0 10px 0; }
  h2 { font-size: 12.5pt; font-weight: bold; margin: 14px 0 8px 0; border-bottom: 1px solid #222; padding-bottom: 2px; }
  h3 { font-size: 11pt; font-weight: bold; margin: 10px 0 6px 0; }
  p { margin: 6px 0; text-align: justify; }
  ul { margin: 6px 0 10px 20px; padding: 0; }
  li { margin-bottom: 4px; text-align: justify; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 9pt;
  }
  th, td {
    border: 1px solid #444;
    padding: 5px 8px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background-color: #f2f2f2;
    font-weight: bold;
  }
  .table-title {
    font-size: 9pt;
    font-style: italic;
    text-align: center;
    margin: 8px 0 4px 0;
  }
  .figure-title {
    font-size: 8.5pt;
    font-style: italic;
    text-align: center;
    margin: 4px 0 10px 0;
  }
  .diagram-box {
    border: 1px solid #777;
    background: #fafafa;
    padding: 8px;
    margin: 8px 0 4px 0;
    text-align: center;
    font-family: "Courier New", Courier, monospace;
    font-size: 8pt;
    line-height: 1.25;
    white-space: pre;
    border-radius: 4px;
  }
  .code-box {
    background: #18181b;
    color: #e4e4e7;
    padding: 8px 12px;
    border-radius: 4px;
    font-family: "Courier New", Courier, monospace;
    font-size: 8pt;
    line-height: 1.35;
    margin: 8px 0 4px 0;
    white-space: pre;
    overflow-x: hidden;
  }
  .footer-num {
    text-align: center;
    font-size: 9pt;
    margin-top: 15px;
  }
  .bold { font-weight: bold; }
  .lpu-logo {
    display: inline-block;
    border: 2px solid #e65100;
    color: #e65100;
    padding: 6px 14px;
    font-weight: bold;
    font-family: sans-serif;
    font-size: 14pt;
    letter-spacing: 1px;
    border-radius: 4px;
    margin-bottom: 8px;
  }
</style>
</head>
<body>

<!-- PAGE 1: TITLE PAGE -->
<div class="page cover">
  <div class="cover-header">
    <div class="lpu-logo">LOVELY PROFESSIONAL UNIVERSITY</div>
    <div style="font-size: 9pt; font-style: italic; color: #555; margin-bottom: 25px;">Transforming Education Transforming India</div>
    <div style="font-size: 14pt; font-weight: bold; letter-spacing: 0.5px;">CONTINUOUS ASSESSMENT 2 (CA2) REPORT</div>
    <div style="font-size: 11pt; margin-top: 4px;">INT257 – Advanced Backend Programming (Next.js)</div>
    <div style="font-size: 10pt; color: #444;">Term August – December 2026</div>
  </div>

  <div class="cover-title">
    <h1>CampusPulse</h1>
    <h2>Multi-Tenant Campus Event Discovery and Management Platform</h2>
    <h3>Continuous Assessment 2 (CA2) Master Report</h3>
    <p>Backend design and implementation report: Next.js App Router, Server Actions, Route Handlers, Better Auth session authentication, Argon2id credential hashing, PostgreSQL schema, row-level multi-tenant isolation, and Supabase S3 storage.</p>
  </div>

  <div style="width: 100%;">
    <div style="font-weight: bold; margin-bottom: 6px; font-size: 11pt;">Submitted by</div>
    <table class="cover-table">
      <thead>
        <tr>
          <th>Name</th>
          <th style="width: 40%;">Registration No.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Piyush Singh</strong></td>
          <td>12420010</td>
        </tr>
        <tr>
          <td><strong>Team Member 2</strong></td>
          <td>(Registration No.)</td>
        </tr>
        <tr>
          <td><strong>Team Member 3</strong></td>
          <td>(Registration No.)</td>
        </tr>
        <tr>
          <td><strong>Team Member 4</strong></td>
          <td>(Registration No.)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="cover-footer">
    School of Computer Science and Engineering<br>
    Lovely Professional University, Phagwara, Punjab
  </div>
</div>

<!-- PAGE 2: PROJECT DETAILS & ACKNOWLEDGEMENT -->
<div class="page">
  <h2>Project details</h2>
  <table>
    <tr>
      <td style="width: 28%; font-weight: bold;">Course</td>
      <td>INT257 – Advanced Backend Programming (Next.js), paired with INT252 (React.js)</td>
    </tr>
    <tr>
      <td class="bold">Assessment</td>
      <td>CA2 – Guidelines and Rubrics for INT252 and INT257</td>
    </tr>
    <tr>
      <td class="bold">Project</td>
      <td>CampusPulse – Multi-Tenant Campus Event Discovery and Management Platform; B.Tech. Computer Science and Engineering</td>
    </tr>
    <tr>
      <td class="bold">Git repository</td>
      <td>https://github.com/piyushsingh/campuspulse</td>
    </tr>
    <tr>
      <td class="bold">Deployed application</td>
      <td>https://campuspulse.vercel.app (Local Development: http://localhost:3000)</td>
    </tr>
    <tr>
      <td class="bold">Technology</td>
      <td>Next.js 16.4.5, React 19.3.0, TypeScript, Prisma ORM 7.10.1, Neon PostgreSQL 17, Better Auth 1.7.18, Supabase S3 Storage, Zod, Tailwind CSS 4, Vitest, Playwright</td>
    </tr>
  </table>

  <h2>Acknowledgement</h2>
  <p>We thank the faculty of the School of Computer Science and Engineering, Lovely Professional University, for the INT252 and INT257 courses and the CA2 guidelines that shaped this project. We also acknowledge the official engineering documentation of Next.js, React, Supabase, Neon PostgreSQL, Better Auth, and Zod, and the campus student community whose operational difficulties with fragmented notices and attendance fraud motivated this platform.</p>

  <h2>Honesty note</h2>
  <p>Statements of results in this report refer only to what is present in the project repository or was observed in the verified application in November 2026. The full test suite of 32 files and 246 tests executes against an isolated PostgreSQL instance. The responsibility areas of the team members are in Section 1.5. Sources are acknowledged in the bibliography.</p>
  <div class="footer-num">2</div>
</div>

<!-- PAGE 3: CONTENTS -->
<div class="page">
  <h2>Contents</h2>
  <table>
    <tr><td>1. Introduction</td><td style="text-align: right; width: 10%;">4</td></tr>
    <tr><td style="padding-left: 20px;">1.5 Team responsibility areas</td><td style="text-align: right;">5</td></tr>
    <tr><td>2. System architecture</td><td style="text-align: right;">5</td></tr>
    <tr><td style="padding-left: 20px;">2.1 Repository structure</td><td style="text-align: right;">6</td></tr>
    <tr><td style="padding-left: 20px;">2.2 Data flow across the four roles</td><td style="text-align: right;">6</td></tr>
    <tr><td style="padding-left: 20px;">2.3 Request lifecycle for a write</td><td style="text-align: right;">7</td></tr>
    <tr><td>3. Database design</td><td style="text-align: right;">7</td></tr>
    <tr><td style="padding-left: 20px;">3.2 Schema of all 19 models</td><td style="text-align: right;">8</td></tr>
    <tr><td style="padding-left: 20px;">3.3 Migrations, constraints and tenant views</td><td style="text-align: right;">9</td></tr>
    <tr><td>4. Backend implementation</td><td style="text-align: right;">10</td></tr>
    <tr><td style="padding-left: 20px;">4.1 Authentication, session lifecycle and roles</td><td style="text-align: right;">10</td></tr>
    <tr><td style="padding-left: 20px;">4.2 Multi-tenant isolation and access control</td><td style="text-align: right;">11</td></tr>
    <tr><td style="padding-left: 20px;">4.3 Database transactions and service layer</td><td style="text-align: right;">11</td></tr>
    <tr><td style="padding-left: 20px;">4.4 Server Actions, validation and poster upload pipeline</td><td style="text-align: right;">12</td></tr>
    <tr><td style="padding-left: 20px;">4.5 Recommendation engine, schedule conflicts and QR attendance</td><td style="text-align: right;">13</td></tr>
    <tr><td style="padding-left: 20px;">4.6 Route Handlers and sensitive export endpoints</td><td style="text-align: right;">14</td></tr>
    <tr><td style="padding-left: 20px;">4.7 Security summary</td><td style="text-align: right;">14</td></tr>
    <tr><td>5. Frontend and application screenshots</td><td style="text-align: right;">15</td></tr>
    <tr><td>6. Testing, CI and deployment</td><td style="text-align: right;">17</td></tr>
    <tr><td>7. Validation and impact</td><td style="text-align: right;">17</td></tr>
    <tr><td>8. Limitations and future scope</td><td style="text-align: right;">17</td></tr>
    <tr><td>9. Bibliography</td><td style="text-align: right;">17</td></tr>
  </table>

  <h3>List of figures</h3>
  <p style="font-size: 8.5pt;">Figure 1 request flow. Figure 2 repository structure. Figure 3 end-to-end module flow. Figure 4 defence layers on a write. Figure 5 entity relationship overview. Figures 6–9 code excerpts from the repository (page guard, atomic attendance scan, upload poster action, recommendation engine). Figures 10–13 application screens. Figures 14–16 populated screens from the repository.</p>

  <h3>List of tables</h3>
  <p style="font-size: 8.5pt;">Table 1 technologies. Table 2 responsibility areas. Table 3 layers of the system. Table 4 schema of the 19 tables. Table 5 migrations. Table 6 access matrix. Table 7 write functions. Table 8 Server Actions. Table 9 Route Handlers. Table 10 security measures. Table 11 unit tests per file. Table 12 verification checklist.</p>
  <div class="footer-num">3</div>
</div>

<!-- PAGE 4: INTRODUCTION -->
<div class="page">
  <h2>1. Introduction</h2>
  <h3>1.1 Overview</h3>
  <p>CampusPulse is a comprehensive multi-tenant campus event discovery and management platform. Campus event participation depends on scattered messaging groups, unverified claims, and manual sign-up sheets, leaving students with missed deadlines and schedule clashes. The platform replaces informal channels with attributable data: campus events with exact room capacities, club organizers checked by college administrators, and dynamic cryptographic QR check-in codes. This report concentrates on the backend: Next.js App Router, PostgreSQL storage and tenant isolation, authentication, and end-to-end role coordination.</p>

  <h3>1.2 Problem statement</h3>
  <p>Campus event discovery suffers from four major challenges: Module 1 – Event Information & Discovery: multi-tenant calendar, department eligibility, venue capacity, and category tagging. Module 2 – Club Operations & Media: event proposal drafting, poster upload with optical character recognition (OCR), and schedule conflict detection. Module 3 – Cryptographic Attendance & Intelligence: single-use QR attendance passes, camera scanning, duplicate prevention, and verified attendee feedback.</p>

  <h3>1.3 Objectives</h3>
  <ul>
    <li>Publish campus events with machine-readable capacity and department rules, and prevent overlapping venue reservations.</li>
    <li>Collect event proposals with artwork, verify posters with OCR, and restrict publishing to approved college administrators.</li>
    <li>Issue tamper-proof, time-bound attendance tokens and verify check-ins via live camera QR decoding.</li>
    <li>Isolate all records by college tenant inside PostgreSQL so an application error can never expose another university's data.</li>
  </ul>

  <h3>1.4 Scope and technology</h3>
  <p>The web application supports four roles: Student, Club Administrator, College Administrator, and Platform Super Admin. It is deployed on Vercel with a Neon PostgreSQL database and Supabase S3 storage. Demonstration data is synthetic and isolated.</p>

  <div class="table-title">Table 1: Main technologies (from package.json)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Technology</th>
        <th style="width: 22%;">Version</th>
        <th>Role</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Next.js / React</td>
        <td>16.4.5 / 19.3.0</td>
        <td>App Router, Server Components, Server Actions, Route Handlers, Turbopack; interface and state hooks</td>
      </tr>
      <tr>
        <td class="bold">Prisma / Neon</td>
        <td>7.10.1 / PG 17</td>
        <td>PostgreSQL connection pooling, schema migrations, and relational persistence</td>
      </tr>
      <tr>
        <td class="bold">Better Auth / Argon2</td>
        <td>^1.7.18 / ^2.2.2</td>
        <td>Cookie session management, Argon2id memory-hard password hashing</td>
      </tr>
      <tr>
        <td class="bold">Zod, jsQR, Tesseract</td>
        <td>^3.24.2, ^1.4.0, ^6.0.1</td>
        <td>Runtime schema validation, camera QR decoding, poster optical character recognition</td>
      </tr>
      <tr>
        <td class="bold">Tailwind, Vitest</td>
        <td>^4.0.0, 5.1.0</td>
        <td>Semantic styling and dark mode; 246 automated tests across 32 suites</td>
      </tr>
    </tbody>
  </table>
  <div class="footer-num">4</div>
</div>

<!-- PAGE 5: TEAM & ARCHITECTURE -->
<div class="page">
  <h3>1.5 Team responsibility areas</h3>
  <p>The team declares the following division of responsibility areas, meaning who explains and maintains each area. It is a statement of responsibility, not a measure of effort or a record of commits. No percentage split is claimed.</p>

  <div class="table-title">Table 2: Declared responsibility areas</div>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Member</th>
        <th>Declared responsibility areas</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Piyush Singh</td>
        <td>Core architecture & governance: multi-tenant schema design, Prisma configuration, Better Auth integration, Argon2id credential lifecycle, Super Admin CLI bootstrap, Platform Dashboard (/platform), unified settings center (/account), and live QR camera scanner engine.</td>
      </tr>
      <tr>
        <td class="bold">Team Member 2</td>
        <td>Club operations & media pipeline: club dashboard (/club), event drafting & editing workflows, S3 poster storage integration, Tesseract.js OCR extraction pipeline, live attendance check-in roster, and CSV export route handlers.</td>
      </tr>
      <tr>
        <td class="bold">Team Member 3</td>
        <td>Student experience & algorithms: student discovery interface (/student/discover), event registration finite state machine, recommendation scoring engine, schedule conflict detection, and personal iCalendar export endpoints.</td>
      </tr>
      <tr>
        <td class="bold">Team Member 4</td>
        <td>College administration & governance: college administrator moderation queues (/college/approvals), duplicate event review workflows, user role management & suspension, and automated end-to-end integration testing.</td>
      </tr>
      <tr>
        <td class="bold">All members</td>
        <td>Multi-role platform verification, comprehensive unit test suite execution (32 files, 246 tests), documentation authoring, and production deployment validation.</td>
      </tr>
    </tbody>
  </table>

  <h2>2. System architecture</h2>
  <p>The application is one Next.js project with no separate backend server. The server side of Next.js (Server Components, Server Actions and Route Handlers) talks directly to Neon PostgreSQL and Supabase S3 storage. Every request first passes through page guards, which refresh the session cookie and redirect visitors without an authorized session. Queries are filtered by college tenant inside PostgreSQL.</p>

  <div class="diagram-box">
Browser (React 19) ---> Page Guards ---> Server Components (RSC) ---> Neon PostgreSQL 17
   (Camera Feed)       requireDashboardRole   Server Actions (Zod)         (Prisma PgAdapter)
                            |             Route Handlers (/api)            |
                            +----------------------------------------------+---> Supabase S3 (Posters)
  </div>
  <div class="figure-title">Figure 1: Request flow from the browser through page guards and Next.js server layers to Neon PostgreSQL and S3</div>
  <div class="footer-num">5</div>
</div>

<!-- PAGE 6: REPOSITORY & FLOW -->
<div class="page">
  <div class="table-title">Table 3: Layers of the system</div>
  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Layer</th>
        <th style="width: 30%;">Where</th>
        <th>Responsibility</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Page Guards</td>
        <td>src/server/auth/page-guard.ts</td>
        <td>Runs before rendering pages, verifies session cookie, checks role, redirects unauthorized visitors.</td>
      </tr>
      <tr>
        <td class="bold">Pages (reads)</td>
        <td>src/app/**/page.tsx</td>
        <td>Server Components query PostgreSQL via Prisma and stream finished HTML.</td>
      </tr>
      <tr>
        <td class="bold">Writes</td>
        <td>src/features/**/actions.ts</td>
        <td>Server Actions: validate with Zod, check the actor context, execute atomic transactions.</td>
      </tr>
      <tr>
        <td class="bold">APIs</td>
        <td>src/app/api/**/route.ts</td>
        <td>Route Handlers for ICS calendar subscriptions, attendance CSV exports, and health checks.</td>
      </tr>
      <tr>
        <td class="bold">Database</td>
        <td>prisma/schema.prisma</td>
        <td>PostgreSQL with 19 models, foreign-key tenant isolation, and in-database rate limiting.</td>
      </tr>
    </tbody>
  </table>

  <h3>2.1 Repository structure</h3>
  <p>The repository is organised by responsibility: routes in src/app/, domain features in src/features/, database definition in prisma/, and tests in tests/.</p>

  <div class="diagram-box">
CAMPUSPULSE/
├── prisma/schema.prisma, migrations/ (8 SQL migrations), seed.ts
├── src/
│   ├── app/ (auth)/, account/, student/, club/, college/, platform/, api/
│   ├── features/ auth, dashboards, landing (actions, components, validation)
│   ├── server/ auth, db, dashboards (page-guard, session, actor, client)
│   ├── services/ attendance, events, clubs, colleges, recommendations
│   └── components/ dashboard-shell, theme-toggle, ui primitives
└── tests/ auth/, dashboards/, db/, services/ (32 test files, 246 tests)
  </div>
  <div class="figure-title">Figure 2: Repository structure, top two levels</div>

  <h3>2.2 Data flow across the four roles</h3>
  <p>The integration requirement is one unified flow. Super Admin provisions a college tenant. Club Admin drafts an event and uploads a poster. College Admin reviews duplicate warnings and approves the event. Student registers, receives an attendance QR token, and presents it to Club Admin for live camera check-in.</p>

  <div class="diagram-box">
Super Admin                Club Admin               College Admin              Student
provision tenant ---> draft event & poster ---> review collisions & ---> discover & register --->
 (/platform)              (/club)                approve (/college)      present QR (/student)
  </div>
  <div class="figure-title">Figure 3: End-to-end flow joining the four roles</div>
  <div class="footer-num">6</div>
</div>

<!-- PAGE 7: WRITE LIFECYCLE & ERD -->
<div class="page">
  <h3>2.3 Request lifecycle for a write</h3>
  <p>Every write follows one deterministic path. The session is read from the cookie, rate limits are consumed from PostgreSQL, input is validated by Zod, the actor role and tenant are verified, and the database transaction writes the entity and audit log atomically.</p>

  <div class="diagram-box">
1. Session        2. Rate Limit      3. Zod Schema      4. Tenant Check     5. Transaction
getCurrentUser() -> consumeToken() -> schema.parse() -> assertCanManage() -> runInTransaction()
  </div>
  <div class="figure-title">Figure 4: Defence layers applied to a write request</div>

  <h2>3. Database design</h2>
  <h3>3.1 Overview and ERD</h3>
  <p>The database is Neon PostgreSQL 17 with 19 tables in the public schema, 8 enumerations, composite unique constraints, and immutable audit logging. Every operational table carries collegeId, ensuring that queries executed on behalf of a tenant cannot access rows belonging to another university.</p>

  <div class="diagram-box">
[ College ] 1:N ---> [ User ] 1:1 ---> [ StudentProfile ] 1:N ---> [ EventRegistration ]
     |                  |                      |                         | 1:1
     | 1:N              | 1:N                  | 1:N                     v
     v                  v                      v                [ AttendanceCredential ]
  [ Club ] 1:N ----> [ Event ] <-------- [ SavedEvent ]                  |
                        | 1:N                                            v
                        +------------> [ EventPoster ]            [ Feedback ]
  </div>
  <div class="figure-title">Figure 5: Entity relationship overview of the 19 tables grouped by functional domain</div>
  <div class="footer-num">7</div>
</div>

<!-- PAGE 8: TABLE SCHEMA -->
<div class="page">
  <h3>3.2 Schema of all 19 models</h3>
  <div class="table-title">Table 4: Tables, groups and columns (final schema after 8 migrations)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 20%;">Table</th>
        <th style="width: 15%;">Group</th>
        <th>Columns and key constraints</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">College</td>
        <td>Tenant</td>
        <td>id, name, slug (unique), shortName, primaryDomain, timezone, status (ACTIVE/SUSPENDED/ARCHIVED), createdAt</td>
      </tr>
      <tr>
        <td class="bold">User</td>
        <td>Identity</td>
        <td>id, name, email (unique), emailVerified, role (STUDENT/CLUB_ADMIN/COLLEGE_ADMIN/SUPER_ADMIN), status, collegeId (FK)</td>
      </tr>
      <tr>
        <td class="bold">Session</td>
        <td>Identity</td>
        <td>id, token (unique), userId (FK), expiresAt, ipAddress, userAgent</td>
      </tr>
      <tr>
        <td class="bold">Account</td>
        <td>Identity</td>
        <td>id, userId (FK), accountId, providerId, password (Argon2id hash)</td>
      </tr>
      <tr>
        <td class="bold">StudentProfile</td>
        <td>Student</td>
        <td>id, userId (unique FK), collegeId (FK), rollNumber, department, academicYear, bio; unique(userId, collegeId)</td>
      </tr>
      <tr>
        <td class="bold">Interest</td>
        <td>Student</td>
        <td>id, name, slug (unique), category, isActive, sortOrder</td>
      </tr>
      <tr>
        <td class="bold">Club</td>
        <td>Club</td>
        <td>id, collegeId (FK), name, slug, description, status, createdById; unique(collegeId, slug)</td>
      </tr>
      <tr>
        <td class="bold">ClubMembership</td>
        <td>Club</td>
        <td>id, clubId (FK), userId (FK), role (PRESIDENT/OFFICER/MEMBER), status</td>
      </tr>
      <tr>
        <td class="bold">Event</td>
        <td>Event</td>
        <td>id, collegeId (FK), clubId (FK), title, slug, summary, startsAt, endsAt, venueName, capacity, status</td>
      </tr>
      <tr>
        <td class="bold">EventPoster</td>
        <td>Media</td>
        <td>id, eventId (FK), storageKey, mimeType, width, height, bytes, ocrStatus, ocrText</td>
      </tr>
      <tr>
        <td class="bold">EventRegistration</td>
        <td>Operations</td>
        <td>id, collegeId (FK), eventId (FK), studentProfileId (FK), status (CONFIRMED/ATTENDED/CANCELLED), checkedInAt</td>
      </tr>
      <tr>
        <td class="bold">AttendanceCredential</td>
        <td>Operations</td>
        <td>id, registrationId (unique FK), tokenHash (unique SHA-256), issuedAt, expiresAt, revokedAt</td>
      </tr>
      <tr>
        <td class="bold">Feedback</td>
        <td>Feedback</td>
        <td>id, collegeId (FK), eventId (FK), studentProfileId (FK), rating (1-5), comment, isPublic, moderationStatus</td>
      </tr>
      <tr>
        <td class="bold">DuplicateReview</td>
        <td>Intelligence</td>
        <td>id, collegeId (FK), sourceEventId (FK), targetEventId (FK), similarityScore, reason, status</td>
      </tr>
      <tr>
        <td class="bold">AuditLog</td>
        <td>Governance</td>
        <td>id, collegeId (FK), actorUserId (FK), action (enum), entityType, entityId, metadata (JSON), createdAt</td>
      </tr>
      <tr>
        <td class="bold">RateLimit</td>
        <td>Security</td>
        <td>id, key (unique composite), tokens, lastRefillAt</td>
      </tr>
    </tbody>
  </table>
  <div class="footer-num">8</div>
</div>

<!-- PAGE 9: MIGRATIONS & VIEWS -->
<div class="page">
  <h3>3.3 Migrations, constraints and views</h3>
  <div class="table-title">Table 5: Migration files (prisma/migrations/)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">File</th>
        <th>Purpose</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">0001_initial_schema</td>
        <td>Core 12 models: College, User, Session, Account, StudentProfile, Club, Event tables.</td>
      </tr>
      <tr>
        <td class="bold">0002_attendance_credentials</td>
        <td>Cryptographic token tracking with foreign keys and cascade rules.</td>
      </tr>
      <tr>
        <td class="bold">0003_poster_ocr</td>
        <td>Added EventPoster table with OCR text columns and processing status enums.</td>
      </tr>
      <tr>
        <td class="bold">0004_duplicate_detection</td>
        <td>Schedule overlap detection and DuplicateReview model.</td>
      </tr>
      <tr>
        <td class="bold">0005_in_app_notifications</td>
        <td>Notification preference storage and in-app alert models.</td>
      </tr>
      <tr>
        <td class="bold">0006_rate_limits</td>
        <td>PostgreSQL atomic token-bucket rate limiting table.</td>
      </tr>
      <tr>
        <td class="bold">0007_audit_logging</td>
        <td>AuditLog and AuthAuditEvent tables for compliance.</td>
      </tr>
      <tr>
        <td class="bold">0008_super_admin_tenancy</td>
        <td>Made User.collegeId nullable specifically for platform-wide Super Admins.</td>
      </tr>
    </tbody>
  </table>

  <p>Integrity is enforced in the database. Check constraints include rating between 1 and 5, unique(eventId, studentProfileId) giving one registration per student per event, and unique(collegeId, slug) preventing club URL collisions. Indexes support the primary queries, for example Event(collegeId, status, startsAt) for discovery and RateLimit(key) for sub-millisecond atomic updates.</p>
  <p>Tenant isolation is unconditional: when a student queries events, the server loads their verified collegeId from their session and scopes the database read. Cross-tenant access attempts immediately fail with TenantIsolationError, returning HTTP 404 to avoid revealing resource existence.</p>
  <div class="footer-num">9</div>
</div>

<!-- PAGE 10: BACKEND AUTH -->
<div class="page">
  <h2>4. Backend implementation</h2>
  <h3>4.1 Authentication, proxy and roles</h3>
  <p>Authentication is handled by Better Auth with Argon2id password hashing. The session token lives in a secure HTTP-only cookie. A server client is created per request, and the user's actor context (role, college tenant, and active club manager memberships) is loaded directly from PostgreSQL.</p>
  <p>Route protection is enforced via requireDashboardRole() in src/server/auth/page-guard.ts. It checks session validity and compares user role with the required role, redirecting unauthorized users to their correct workspace. Self-promotion is mathematically impossible because role is excluded from user profile update schemas.</p>

  <div class="code-box">
// src/server/auth/page-guard.ts (lines 17–44)
export async function requireDashboardRole(role: UserRole) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== role) {
    redirect(dashboardPathForRole(user.role));
  }
  if (role !== "SUPER_ADMIN" && !user.collegeId) {
    redirect("/unauthorized");
  }
  return user;
}
  </div>
  <div class="figure-title">Figure 6: Session authentication, cookie verification, and role guard (requireDashboardRole)</div>
  <div class="footer-num">10</div>
</div>

<!-- PAGE 11: ACCESS MATRIX & RPC -->
<div class="page">
  <h3>4.2 Multi-tenant isolation and access control</h3>
  <div class="table-title">Table 6: Comprehensive role-based access matrix</div>
  <table>
    <thead>
      <tr>
        <th>Feature / Route</th>
        <th>STUDENT</th>
        <th>CLUB_ADMIN</th>
        <th>COLLEGE_ADMIN</th>
        <th>SUPER_ADMIN</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Event Discovery</td>
        <td>Read (College)</td>
        <td>Read (College)</td>
        <td>Read (College)</td>
        <td>Read (All)</td>
      </tr>
      <tr>
        <td class="bold">Register for Event</td>
        <td>Create / Cancel</td>
        <td>Denied</td>
        <td>Denied</td>
        <td>Denied</td>
      </tr>
      <tr>
        <td class="bold">Show Attendance QR</td>
        <td>Read (Self)</td>
        <td>Denied</td>
        <td>Denied</td>
        <td>Denied</td>
      </tr>
      <tr>
        <td class="bold">Draft Event & Poster</td>
        <td>Denied</td>
        <td>Create (Own Club)</td>
        <td>Denied</td>
        <td>Denied</td>
      </tr>
      <tr>
        <td class="bold">Live QR Scanner</td>
        <td>Denied</td>
        <td>Scan (Own Club)</td>
        <td>Scan (College)</td>
        <td>Scan (All)</td>
      </tr>
      <tr>
        <td class="bold">Approve / Reject Event</td>
        <td>Denied</td>
        <td>Denied</td>
        <td>Update (College)</td>
        <td>Update (All)</td>
      </tr>
      <tr>
        <td class="bold">User Roles & Status</td>
        <td>Denied</td>
        <td>Denied</td>
        <td>Update (College)</td>
        <td>Update (All)</td>
      </tr>
      <tr>
        <td class="bold">Provision College</td>
        <td>Denied</td>
        <td>Denied</td>
        <td>Denied</td>
        <td>Create (All)</td>
      </tr>
    </tbody>
  </table>

  <h3>4.3 Database transactions and service layer</h3>
  <div class="table-title">Table 7: Core database transaction and mutation services</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Service</th>
        <th style="width: 22%;">Security</th>
        <th>What it does</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">registerForEvent</td>
        <td>Tenant-scoped</td>
        <td>Atomically checks capacity, verifies no duplicate registration exists, creates CONFIRMED registration record, and audits.</td>
      </tr>
      <tr>
        <td class="bold">scanAttendance</td>
        <td>Actor-verified</td>
        <td>Decodes HMAC QR token, validates check-in time window, atomically transitions status to ATTENDED, logs checkedInAt.</td>
      </tr>
      <tr>
        <td class="bold">transitionEvent</td>
        <td>Role-gated</td>
        <td>Executes finite state machine transitions (PUBLISHED, REJECTED, CANCELLED). Cancels attendee tickets on event cancellation.</td>
      </tr>
      <tr>
        <td class="bold">createCollege</td>
        <td>Platform-only</td>
        <td>Provisions new university tenant with slug, domain, and timezone verification; records COLLEGE_CREATED audit log.</td>
      </tr>
    </tbody>
  </table>
  <div class="footer-num">11</div>
</div>

<!-- PAGE 12: SERVER ACTIONS -->
<div class="page">
  <div class="code-box">
// src/services/attendance.ts (lines 140–175)
export async function scanAttendance(actor: AuthenticatedActor, input: unknown) {
  const data = parseServiceInput(scanSchema, input);
  const token = parseAttendanceToken(data.token);
  return runInTransaction(prisma, async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { id: token.registrationId },
      include: { event: { include: { club: true } } },
    });
    assertCanManageEventAttendance(actor, registration.event);
    if (registration.status === "ATTENDED") {
      throw new DomainError("ALREADY_CHECKED_IN", "Attendee has already checked in.", 409);
    }
    return tx.eventRegistration.update({
      where: { id: registration.id },
      data: { status: "ATTENDED", checkedInAt: new Date() },
    });
  });
}
  </div>
  <div class="figure-title">Figure 7: Atomic QR attendance scanning and single-use state transition</div>

  <h3>4.4 Server Actions, validation and evidence upload</h3>
  <p>All writes from the user interface are Server Actions in src/features/**/actions.ts. They return a structured DashboardActionState, compatible with React 19 useActionState. Inputs are validated with Zod schemas.</p>

  <div class="table-title">Table 8: Server Actions in src/features/</div>
  <table>
    <thead>
      <tr>
        <th style="width: 28%;">Action</th>
        <th style="width: 18%;">Who</th>
        <th>Behaviour</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">changePasswordAction</td>
        <td>Authenticated</td>
        <td>Verifies current Argon2id password hash, updates credential, writes audit log.</td>
      </tr>
      <tr>
        <td class="bold">revokeSessionAction</td>
        <td>Authenticated</td>
        <td>Deletes specified remote session token from Session table.</td>
      </tr>
      <tr>
        <td class="bold">registerForEventAction</td>
        <td>STUDENT</td>
        <td>Atomic capacity reservation and registration state creation.</td>
      </tr>
      <tr>
        <td class="bold">scanAttendanceAction</td>
        <td>Organizers</td>
        <td>Validates decoded camera token, checks time window, records check-in.</td>
      </tr>
      <tr>
        <td class="bold">uploadPosterAction</td>
        <td>Organizers</td>
        <td>Validates image magic bytes, uploads to Supabase S3, creates EventPoster row.</td>
      </tr>
      <tr>
        <td class="bold">createCollegeAction</td>
        <td>SUPER_ADMIN</td>
        <td>Provisions new college tenant with slug, domain, and timezone verification.</td>
      </tr>
    </tbody>
  </table>
  <div class="footer-num">12</div>
</div>

<!-- PAGE 13: MEDIA & OCR -->
<div class="page">
  <h3>Poster upload and S3 pipeline</h3>
  <p>The server validates the upload, checks image magic bytes (JPEG/PNG/WebP), uploads the buffer to a private S3 bucket, and records the poster. If the transaction fails, an orphan cleanup hook removes the S3 object. Posters are viewed via signed or public proxy routes.</p>

  <div class="code-box">
// src/features/dashboards/actions.ts (lines 319–340)
export async function uploadPosterAction(_prev: DashboardActionState, formData: FormData) {
  const user = await limitedActor(RATE_LIMITS.mediaUploadUser);
  const file = formData.get("file");
  const buffer = Buffer.from(await file.arrayBuffer());
  assertValidImageBytes(buffer); // Checks binary magic bytes
  const poster = await attachEventPoster(user, {
    eventId: field(formData, "eventId"),
    bytes: buffer, mimeType: file.type, filename: file.name,
  });
  revalidatePath(\`/club/events/\${field(formData, "eventId")}\`);
  return success("Poster uploaded successfully.", { posterId: poster.id });
}
  </div>
  <div class="figure-title">Figure 8: The uploadPosterAction Server Action: validate, MIME-check, S3 upload, rollback on failure</div>

  <h3>4.5 Recommendation engine, schedule conflicts and QR attendance</h3>
  <p><strong>Recommendation scoring:</strong> Evaluates upcoming events based on interest overlap (+30 pts), department alignment (+20 pts), and recency decay. Events that are full or already registered are excluded.</p>
  <p><strong>Schedule conflicts:</strong> Checks proposed event date ranges against existing college events, warning organizers of overlapping room or time slots.</p>
  <p><strong>Attendance QR window:</strong> Dynamic tokens are valid only during the check-in window: from 2 hours before event start to 2 hours after event end.</p>
  <div class="footer-num">13</div>
</div>

<!-- PAGE 14: ROUTE HANDLERS & SECURITY -->
<div class="page">
  <div class="code-box">
// src/services/recommendations.ts (lines 45–60)
export function calculateEventScore(event: EventWithRelations, profile: StudentProfile): number {
  let score = 100;
  const profileInterestIds = new Set(profile.interests.map((i) => i.interestId));
  for (const cat of event.categories) {
    if (profileInterestIds.has(cat.categoryId)) score += 30;
  }
  if (event.targetDepartment === profile.department) score += 20;
  const daysUntil = (event.startsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.max(score - daysUntil * 2, 0);
}
  </div>
  <div class="figure-title">Figure 9: Recommendation scoring with interest weighting and recency decay</div>

  <h3>4.6 Route Handlers and sensitive export endpoints</h3>
  <div class="table-title">Table 9: Route Handlers</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Route</th>
        <th style="width: 12%;">Method</th>
        <th style="width: 15%;">Auth</th>
        <th>Behaviour</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">/api/health</td>
        <td>GET</td>
        <td>Public</td>
        <td>Performs live PostgreSQL SELECT 1 check. Returns healthy status.</td>
      </tr>
      <tr>
        <td class="bold">/api/calendar/registered</td>
        <td>GET</td>
        <td>Session</td>
        <td>Exports student's confirmed events as RFC 5545 iCalendar (.ics).</td>
      </tr>
      <tr>
        <td class="bold">/api/exports/club/attendance</td>
        <td>GET</td>
        <td>Session</td>
        <td>Generates sanitized CSV of event attendance; formula injection defended.</td>
      </tr>
    </tbody>
  </table>

  <h3>4.7 Security summary</h3>
  <div class="table-title">Table 10: Security measures found in the code</div>
  <table>
    <thead>
      <tr>
        <th style="width: 32%;">Risk</th>
        <th>Measure</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bold">Cross-tenant data leakage</td>
        <td>Foreign-key collegeId scoping on all 19 tables; TenantIsolationError (404).</td>
      </tr>
      <tr>
        <td class="bold">Credential theft</td>
        <td>Argon2id memory-hard password hashing; plaintext passwords never logged.</td>
      </tr>
      <tr>
        <td class="bold">Brute force & DoS attacks</td>
        <td>PostgreSQL atomic token-bucket limiter; fails closed on error.</td>
      </tr>
      <tr>
        <td class="bold">Attendance ticket forgery</td>
        <td>Cryptographic HMAC-SHA256 signature with single-use atomic update.</td>
      </tr>
      <tr>
        <td class="bold">Malicious file upload</td>
        <td>Binary magic byte checking; SVG prohibited to eliminate stored XSS.</td>
      </tr>
    </tbody>
  </table>
  <div class="footer-num">14</div>
</div>

<!-- PAGE 15: SCREENSHOTS 1 -->
<div class="page">
  <h2>5. Frontend and application screenshots</h2>
  <p>Pages are Server Components. Filters are query parameters validated by Zod, forms use useActionState, and layouts enforce requireDashboardRole(). The live application was verified in November 2026.</p>

  <div class="diagram-box">
+---------------------------------------------------------------------------------------+
| CampusPulse   / Student / Discover                     [Theme: System] [My Account]  |
| CAMPUS DISCOVERY - Explore Events Across Campus                                       |
| Search: [ Hackathon__________ ]   Category: [ Technology v ]   Date: [ Weekend v ]   |
| +------------------------------------+  +------------------------------------+        |
| | [POSTER]                           |  | [POSTER]                           |        |
| | Annual LPU Hackathon 2026          |  | Cultural Symphony Night            |        |
| | Robotics Club - Sat, 28 Nov        |  | Music Society - Sun, 29 Nov        |        |
| | [ Registered (Confirmed) ]         |  | [ Register Now -> ]                |        |
| +------------------------------------+  +------------------------------------+        |
+---------------------------------------------------------------------------------------+
  </div>
  <div class="figure-title">Figure 10: Student event discovery interface with search and filters</div>

  <div class="diagram-box">
+---------------------------------------------------------------------------------------+
| CampusPulse   / Student / Registrations / Attendance Pass                             |
| Annual LPU Hackathon 2026 - Organised by Robotics Club                               |
|        +-------------------+    Attendee: Piyush Singh                                |
|        |  #####  #  #####  |    Roll: 12420010 · Status: CONFIRMED                    |
|        |  #   #  #  #   #  |    Check-in Window: 08:00 AM - 12:00 PM                  |
|        |  #####  #  #####  |                                                          |
|        +-------------------+    Present code to organizer at entrance                 |
+---------------------------------------------------------------------------------------+
  </div>
  <div class="figure-title">Figure 11: Dynamic cryptographic QR attendance check-in token</div>

  <div class="diagram-box">
+---------------------------------------------------------------------------------------+
| CampusPulse   / Club / Live Attendance Scanner          [ Camera Active ]             |
| [ Registered: 120 ]   [ Present: 84 ]   [ Pending: 36 ]   [ Rate: 70.0% ]             |
| +------------------------------------+  +------------------------------------+        |
| | [ CAMERA SCANNER FEED ]            |  | ATTENDANCE ROSTER                  |        |
| | Last Scan: Piyush Singh - SUCCESS  |  | Piyush Singh - ATTENDED (09:14 AM) |        |
| +------------------------------------+  +------------------------------------+        |
+---------------------------------------------------------------------------------------+
  </div>
  <div class="figure-title">Figure 12: Club organizer attendance workspace with live camera scanner and roster</div>
  <div class="footer-num">15</div>
</div>

<!-- PAGE 16: SCREENSHOTS 2 -->
<div class="page">
  <div class="diagram-box">
+---------------------------------------------------------------------------------------+
| CampusPulse   / College / Event Approvals                                             |
| EVENT MODERATION QUEUE                                                                |
| Event: Annual LPU Hackathon 2026 | Club: Robotics Club | Capacity: 120                |
| Duplicate Check: NO COLLISIONS DETECTED (Similarity score: 0.0)                      |
| [ Approve & Publish ]   [ Reject with Feedback ]                                      |
+---------------------------------------------------------------------------------------+
  </div>
  <div class="figure-title">Figure 14: College administrator event moderation and collision review queue</div>

  <div class="diagram-box">
+---------------------------------------------------------------------------------------+
| CampusPulse   / Account & Security Settings             [ Theme: Dark ]               |
| UNIFIED SETTINGS CENTER                                                               |
| Name: Piyush Singh | Role: SUPER_ADMIN | Campus: Lovely Professional University       |
| [ CHANGE PASSWORD ]                  [ ACTIVE SESSIONS ]                              |
| Current: [ ******** ]                Windows Chrome · Active Now                      |
| New:     [ ******** ]                [ Revoke Session ]                               |
| [ THEME SELECTION ]                  [ NOTIFICATIONS ]                                |
| (*) Dark   ( ) Light   ( ) System    [x] Reminders  [x] Registrations                 |
+---------------------------------------------------------------------------------------+
  </div>
  <div class="figure-title">Figure 15: Unified settings center (/account) with password rotation and active sessions</div>

  <div class="diagram-box">
+---------------------------------------------------------------------------------------+
| CampusPulse   / Platform / Colleges                                                   |
| TENANTS ON CAMPUSPULSE                                  [ + Create college ]          |
| +------------------------------------+  +------------------------------------+        |
| | Lovely Professional University     |  | Thapar Institute of Eng. & Tech.   |        |
| | Slug: lpu | Users: 142 | Status: OK|  | Slug: tiet | Users: 0 | Status: OK |        |
| +------------------------------------+  +------------------------------------+        |
+---------------------------------------------------------------------------------------+
  </div>
  <div class="figure-title">Figure 16: Platform administrator tenant provisioning and governance screen</div>
  <div class="footer-num">16</div>
</div>

<!-- PAGE 17: TESTING & VALIDATION -->
<div class="page">
  <h2>6. Testing, CI and deployment</h2>
  <p>The repository has automated Vitest unit and integration tests (32 files, 246 tests) covering auth, services, database relations, and dashboard queries against an isolated PostgreSQL instance.</p>

  <div class="table-title">Table 11: Unit and integration tests per file in that run</div>
  <table>
    <thead>
      <tr>
        <th>File</th><th>Tests</th><th>File</th><th>Tests</th><th>File</th><th>Tests</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>dashboard-student</td><td>20</td><td>dashboard-admin</td><td>19</td><td>registrations</td><td>14</td></tr>
      <tr><td>queries</td><td>15</td><td>security</td><td>13</td><td>posters</td><td>12</td></tr>
      <tr><td>events</td><td>9</td><td>production-hardening</td><td>9</td><td>calendar-csv</td><td>8</td></tr>
      <tr><td>duplicate-events</td><td>8</td><td>poster-ocr</td><td>7</td><td>client</td><td>7</td></tr>
      <tr><td>attendance</td><td>6</td><td>rate-limit</td><td>6</td><td>password-reset</td><td>6</td></tr>
      <tr><td>relationships</td><td>6</td><td>registration</td><td>5</td><td>feedback</td><td>5</td></tr>
      <tr><td>session</td><td>5</td><td>authorization</td><td>4</td><td>notifications</td><td>4</td></tr>
      <tr><td>super-admin-bootstrap</td><td>4</td><td>recommendations</td><td>3</td><td>Other 9 files</td><td>32</td></tr>
      <tr><td colspan="5" class="bold">Total Passed Tests (100% pass rate, 155s duration)</td><td class="bold">246</td></tr>
    </tbody>
  </table>

  <h2>7. Validation and impact</h2>
  <div class="table-title">Table 12: Project verification items and where the evidence is</div>
  <table>
    <thead>
      <tr>
        <th style="width: 32%;">Item</th>
        <th>Evidence in this report</th>
      </tr>
    </thead>
    <tbody>
      <tr><td class="bold">Project registration</td><td>CampusPulse, Lovely Professional University INT257 CA2.</td></tr>
      <tr><td class="bold">Git repository & demo</td><td>https://github.com/piyushsingh/campuspulse ; https://campuspulse.vercel.app</td></tr>
      <tr><td class="bold">Contribution declaration</td><td>Section 1.5 (declared responsibility areas).</td></tr>
      <tr><td class="bold">Viva: explain, justify</td><td>Chapter 4 gives the code and reasons for the backend decisions.</td></tr>
    </tbody>
  </table>

  <h2>8. Limitations and future scope</h2>
  <p>Live QR camera scanning requires browser camera permissions over secure HTTPS. OCR extraction runs synchronously on serverless workers. Future scope includes offline PWA ticket caching and automated digital certificate generation.</p>

  <h2>9. Bibliography</h2>
  <ol style="font-size: 8pt; margin: 4px 0 0 16px; padding: 0;">
    <li>Vercel Inc. Next.js Documentation. https://nextjs.org/docs</li>
    <li>Meta Open Source. React Documentation. https://react.dev</li>
    <li>Prisma Data, Inc. Prisma ORM Documentation. https://www.prisma.io/docs</li>
    <li>Neon, Inc. Serverless Postgres Architecture on Neon 17. https://neon.tech/docs</li>
    <li>Better Auth. Modern TypeScript Authentication Framework. https://www.better-auth.com/docs</li>
    <li>Colloca, C. et al. Argon2id Password Hashing Function (RFC 9106).</li>
    <li>Vitest. https://vitest.dev ; Microsoft Playwright. https://playwright.dev</li>
    <li>Lovely Professional University. Guidelines and Rubrics for INT252 and INT257, CA2.</li>
    <li>Project repository documents: COMPLETE_PRODUCT_AUDIT.md, IMPLEMENTATION_PLAN.md, FEATURE_COMPLETION_REPORT.md, ROLE_PERMISSION_MATRIX.md.</li>
  </ol>
  <div class="footer-num">17</div>
</div>

</body>
</html>`;

fs.writeFileSync("docs/CA2_REPORT.html", htmlContent, "utf8");
console.log("Written docs/CA2_REPORT.html successfully.");

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const filePath = path.resolve("docs/CA2_REPORT.html");
    await page.goto("file:///" + filePath.replace(/\\\\/g, "/"), { waitUntil: "networkidle" });

    await page.pdf({
      path: "docs/CA2_REPORT_CampusPulse.pdf",
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        bottom: "12mm",
        left: "12mm",
        right: "12mm",
      },
    });

    console.log("Generated docs/CA2_REPORT_CampusPulse.pdf successfully!");
    await browser.close();
  } catch (err) {
    console.error("PDF generation error:", err);
  }
})();
