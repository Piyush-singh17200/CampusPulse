import { csvDownloadHeaders } from "@/lib/csv";
import { analyticsQueryFromParams } from "@/lib/analytics-query";
import { RATE_LIMITS, enforceRateLimit } from "@/server/auth/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { getClubEngagementAnalytics } from "@/server/dashboards/engagement-analytics";
import { recordExportAudit } from "@/server/exports/audit";
import { clubAnalyticsCsv } from "@/server/exports/analytics-csv";
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

  try {
    await enforceRateLimit(RATE_LIMITS.exportDownloadUser, user.id);
  } catch (error) {
    return errorResponse(error);
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());

  try {
    const data = await getClubEngagementAnalytics(
      user,
      params.clubId ?? params.club,
      analyticsQueryFromParams(params),
    );

    if (!data.club) {
      return emptyResponse(404);
    }

    await recordExportAudit(user, {
      kind: "club-analytics",
      scope: data.club.id,
      format: "csv",
      rowCount: data.eventBreakdown.length,
    });

    const csv = clubAnalyticsCsv(data);
    return new Response(csv.body, {
      status: 200,
      headers: csvDownloadHeaders(csv.filename),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
