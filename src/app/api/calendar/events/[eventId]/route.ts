import { icsDownloadHeaders } from "@/lib/csv";
import { RATE_LIMITS, enforceRateLimit } from "@/server/auth/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { recordExportAudit } from "@/server/exports/audit";
import { emptyResponse, errorResponse } from "@/server/http/responses";
import { getEventCalendarExport } from "@/services/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    user = await getCurrentUser();
  } catch {
    return emptyResponse(401);
  }

  if (!user) {
    return emptyResponse(401);
  }

  try {
    await enforceRateLimit(RATE_LIMITS.exportDownloadUser, user.id);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    const { eventId } = await params;
    const calendar = await getEventCalendarExport(user, eventId);

    if (!calendar) {
      return emptyResponse(404);
    }

    await recordExportAudit(user, {
      kind: "calendar-event",
      scope: eventId,
      format: "ics",
      rowCount: calendar.count,
      truncated: calendar.truncated,
    });

    return new Response(calendar.body, {
      status: 200,
      headers: {
        ...icsDownloadHeaders(calendar.filename),
        "X-Export-Row-Count": String(calendar.count),
        "X-Export-Truncated": String(calendar.truncated),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
