import { csvDownloadHeaders } from "@/lib/csv";
import { analyticsQueryFromParams } from "@/lib/analytics-query";
import { RATE_LIMITS, enforceRateLimit } from "@/server/auth/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { getPlatformEngagementAnalytics } from "@/server/dashboards/engagement-analytics";
import { recordExportAudit } from "@/server/exports/audit";
import { platformAnalyticsCsv } from "@/server/exports/analytics-csv";
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

  const params = Object.fromEntries(new URL(request.url).searchParams.entries());

  try {
    await enforceRateLimit(RATE_LIMITS.exportDownloadUser, user.id);
  } catch (error) {
    return errorResponse(error);
  }

  try {
    const data = await getPlatformEngagementAnalytics(user, analyticsQueryFromParams(params));

    await recordExportAudit(user, {
      kind: "platform-analytics",
      scope: "platform",
      format: "csv",
      rowCount: data.collegeActivity.length,
    });

    const csv = platformAnalyticsCsv(data);

    return new Response(csv.body, {
      status: 200,
      headers: csvDownloadHeaders(csv.filename),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
