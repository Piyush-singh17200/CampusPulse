import "server-only";

import { serializeCsv } from "@/lib/csv";
import type { getClubAttendanceExport } from "@/server/dashboards/engagement-analytics";
import type {
  getClubEngagementAnalytics,
  getCollegeEngagementAnalytics,
  getPlatformEngagementAnalytics,
} from "@/server/dashboards/engagement-analytics";

type ClubAttendanceExport = Awaited<ReturnType<typeof getClubAttendanceExport>>;
type ClubAnalytics = Awaited<ReturnType<typeof getClubEngagementAnalytics>>;
type CollegeAnalytics = Awaited<ReturnType<typeof getCollegeEngagementAnalytics>>;
type PlatformAnalytics = Awaited<ReturnType<typeof getPlatformEngagementAnalytics>>;

function slug(value: string): string {
  return (
    value
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "campuspulse"
  );
}

function dateStamp(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function clubAttendanceCsv(data: ClubAttendanceExport) {
  const rows = data.registrations.map((registration) => [
    registration.studentProfile.user.name,
    registration.studentProfile.rollNumber ?? "",
    registration.studentProfile.department ?? "",
    registration.status,
    registration.registeredAt.toISOString(),
    registration.checkedInAt?.toISOString() ?? "",
  ]);

  return {
    filename: `campuspulse-attendance-${slug(data.event.title)}-${dateStamp(data.event.startsAt)}.csv`,
    body: serializeCsv(
      ["Student", "Roll number", "Department", "Status", "Registered at", "Checked in at"],
      rows,
    ),
  };
}

export function clubAnalyticsCsv(data: ClubAnalytics) {
  const rows = data.eventBreakdown.map((event) => [
    data.club?.name ?? "",
    event.title,
    event.startsAt.toISOString(),
    event.status,
    event.totalRegistrations,
    event.activeRegistrations,
    event.cancelledRegistrations,
    event.attended,
    event.noShow,
    event.eligible,
    event.attendanceRate ?? "",
    event.averageRating === null ? "" : event.averageRating.toFixed(2),
    event.feedbackCount,
  ]);

  return {
    filename: `campuspulse-club-analytics-${slug(data.club?.name ?? "club")}-${data.filters.from}-${data.filters.to}.csv`,
    body: serializeCsv(
      [
        "Club",
        "Event",
        "Starts at",
        "Event status",
        "Total registrations",
        "Active registrations",
        "Cancelled registrations",
        "Attended",
        "No show",
        "Eligible registrations",
        "Attendance rate (%)",
        "Average rating",
        "Feedback responses",
      ],
      rows,
    ),
  };
}

export function collegeAnalyticsCsv(data: CollegeAnalytics) {
  const rows = data.eventBreakdown.map((event) => [
    event.clubName,
    event.title,
    event.startsAt.toISOString(),
    event.status,
    event.totalRegistrations,
    event.activeRegistrations,
    event.cancelledRegistrations,
    event.attended,
    event.noShow,
    event.eligible,
    event.attendanceRate ?? "",
    event.averageRating === null ? "" : event.averageRating.toFixed(2),
    event.feedbackCount,
  ]);

  return {
    filename: `campuspulse-college-analytics-${slug(data.college.shortName ?? data.college.name)}-${data.filters.from}-${data.filters.to}.csv`,
    body: serializeCsv(
      [
        "Club",
        "Event",
        "Starts at",
        "Event status",
        "Total registrations",
        "Active registrations",
        "Cancelled registrations",
        "Attended",
        "No show",
        "Eligible registrations",
        "Attendance rate (%)",
        "Average rating",
        "Feedback responses",
      ],
      rows,
    ),
  };
}

export function platformAnalyticsCsv(data: PlatformAnalytics) {
  const rows: (string | number | null)[][] = [
    ["Active colleges", "", data.activeColleges],
    ["Active users", "", data.activeUsers],
    ["Total events", "", data.totalEvents],
    ["Published events", "", data.publishedEvents],
    ["Completed events", "", data.completedEvents],
    ["Total registrations", "", data.totalRegistrations],
    ["Attended registrations", "", data.attendedRegistrations],
    ["Eligible registrations", "", data.eligibleRegistrations],
    ["Attendance rate (%)", "", data.attendanceRate ?? ""],
    ["Event completion rate (%)", "", data.eventCompletionRate ?? ""],
    ["Average rating", "", data.averageRating === null ? "" : data.averageRating.toFixed(2)],
    ["Feedback responses", "", data.feedbackResponseCount],
    ...data.collegeActivity.map((college) => ["College activity", college.name, college.count]),
  ];

  return {
    filename: `campuspulse-platform-analytics-${data.filters.from}-${data.filters.to}.csv`,
    body: serializeCsv(["Section", "Metric or college", "Value"], rows),
  };
}
