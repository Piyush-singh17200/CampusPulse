import { csvDownloadHeaders } from "@/lib/csv";
import { RATE_LIMITS, enforceRateLimit } from "@/server/auth/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { getClubAttendanceExport } from "@/server/dashboards/engagement-analytics";
import { recordExportAudit } from "@/server/exports/audit";
import { clubAttendanceCsv } from "@/server/exports/analytics-csv";
import { emptyResponse, errorResponse } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    user = await getCurrentUser();
  } catch {
    return emptyResponse(401);
  }

  if (!user) {
    return emptyResponse(401);
  }

  const url = new URL(request.url);
  const clubId = url.searchParams.get("clubId") ?? "";
  const eventId = url.searchParams.get("eventId") ?? "";

  if (!clubId || !eventId) {
    return emptyResponse(400);
  }

  try {
    await enforceRateLimit(RATE_LIMITS.exportDownloadUser, user.id);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    const data = await getClubAttendanceExport(user, clubId, eventId);

    await recordExportAudit(user, {
      kind: "club-attendance",
      scope: eventId,
      format: "csv",
      rowCount: data.registrations.length,
    });

    const csv = clubAttendanceCsv(data);

    return new Response(csv.body, {
      status: 200,
      headers: csvDownloadHeaders(csv.filename),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
