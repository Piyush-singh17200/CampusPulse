# CampusPulse — Comprehensive User Guide

Welcome to CampusPulse! This guide provides a step-by-step walkthrough for all users: Students, Club Executives, College Administrators, and Platform Operators.

---

## 1. Getting Started

### 1.1 Account Registration

1. Navigate to `/register`.
2. Select your campus from the **College** dropdown.
3. Enter your student name, official student email, and password.
4. Click **Create student account**.
5. Upon registration, you are immediately signed in to your **Student Workspace**.

### 1.2 Signing In & Out

- Sign in at `/login` using your registered email and password.
- Sign out at any time by clicking the **Sign out** button located in the dashboard sidebar footer.

### 1.3 Managing Your Account (`/account`)

Click your user card or the **Settings** link in the navigation to access your unified settings center:

- **Change Password:** Enter your current password followed by your new password.
- **Active Sessions:** Review devices currently signed in to your account. Click **Revoke** next to any unrecognized device.
- **Theme Selection:** Toggle between **System**, **Light**, and **Dark** modes.
- **Notification Toggles:** Enable or disable optional notifications for reminders, registrations, and club updates.

---

## 2. Student Guide

### 2.1 Discovering Campus Events (`/student/discover`)

- Search events by title, summary, or venue name.
- Filter by Category (e.g. Technology, Cultural, Sports), Date Range, or Venue.
- Save events for quick access later by clicking the **Save** bookmark icon.

### 2.2 Registering for an Event

1. Open any published event card from Discovery or Overview.
2. Review the event schedule, capacity, and organizer details.
3. Click **Register for event**. If the event has capacity, your registration status becomes `CONFIRMED`.
4. If your plans change, click **Cancel registration** at any time before the event starts.

### 2.3 Checking In at Events (QR Code)

1. On the day of the event, go to `/student/registrations`.
2. Open the event registration and click **Show QR Check-in Code**.
3. A single-use, time-bound QR code appears on your screen.
4. Present this QR code to the club organizer scanning attendee tickets at the venue entrance.
5. Your status updates instantly to `ATTENDED`.

### 2.4 Personal Calendar Sync (`/student/calendar`)

- View all your confirmed and attended events laid out chronologically on your campus calendar.
- Click **Export iCalendar (.ics)** to subscribe to your CampusPulse schedule inside Google Calendar, Apple Calendar, or Outlook.

### 2.5 Submitting Verified Feedback (`/student/feedback`)

- After attending an event, share your anonymous or authenticated feedback and 1–5 star rating.
- Feedback helps clubs improve future events and guides campus administrative oversight.

---

## 3. Club Administrator Guide

### 3.1 Creating & Submitting an Event (`/club/events/create`)

1. From the Club Dashboard, select **Create event**.
2. Fill in the event title, summary, category, date range, venue, and attendance capacity.
3. Click **Create draft**.
4. Upload an event poster on the edit screen. CampusPulse can automatically extract event details via optical character recognition (OCR).
5. When ready, click **Submit for approval**. Your event moves into the College moderation queue (`PENDING_APPROVAL`).

### 3.2 Live Attendance Scanning (`/club/attendance`)

1. Select the event from your attendance dashboard.
2. Ensure your device camera is enabled. Click **Start camera scanner**.
3. Scan students' QR codes as they arrive. Successful check-ins flash a green confirmation with student name and timestamp.
4. For manual check-in or corrections, locate the student in the roster below and submit a correction with a mandatory audit reason.
5. Export full attendance data anytime via **Export attendance CSV**.

---

## 4. College Administrator Guide

### 4.1 Event Moderation Queue (`/college/approvals`)

- Review submitted events from campus clubs.
- Inspect poster artwork, venue capacity, schedule conflicts, and duplicate event alerts.
- Click **Approve and publish** to make the event visible to students, or **Reject event** with constructive feedback.

### 4.2 College Attendance & QR Scanner (`/college/events/[eventId]/attendance`)

- College administrators can oversee and participate in attendance check-in for any event in their college.
- Open the event detail screen and click **Attendance & QR scanner**.
- Use the live camera scanner or the searchable attendee table to adjust attendance statuses.

### 4.3 User Governance & Role Assignment (`/college/users`)

- Inspect all student and club organizer accounts registered under your college.
- Promote active student leaders to `CLUB_ADMIN` or appoint faculty/staff as fellow `COLLEGE_ADMIN`s.
- Suspend accounts exhibiting policy violations.

---

## 5. Platform Administrator Guide (`/platform`)

### 5.1 Provisioning College Tenants (`/platform/colleges`)

1. From `/platform/colleges`, click **Create college**.
2. Enter the college name, unique URL slug, short abbreviation, primary email domain, and IANA timezone.
3. Click **Create college**. The tenant is active immediately.

### 5.2 Tenant Lifecycle Management

- Click any college to review its counts of users, clubs, and events.
- Change college status to `SUSPENDED` or `ARCHIVED` if the partnership ends. This immediately revokes all active sessions for users in that college tenant.
