import { extensionForMimeType } from "@/server/posters/image";
import { RATE_LIMITS, enforceRateLimit } from "@/server/auth/rate-limit";
import { getCurrentUser } from "@/server/auth/session";
import { errorResponse } from "@/server/http/responses";
import { getEventPosterForActor } from "@/services/posters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
  Vary: "Cookie",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ posterId: string }> },
) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    user = await getCurrentUser();
  } catch {
    return new Response(null, { status: 401, headers: NO_STORE_HEADERS });
  }

  if (!user) {
    return new Response(null, { status: 401, headers: NO_STORE_HEADERS });
  }

  try {
    await enforceRateLimit(RATE_LIMITS.posterReadUser, user.id);
  } catch (error) {
    return errorResponse(error);
  }

  const { posterId } = await params;

  try {
    const poster = await getEventPosterForActor(user, posterId);

    if (!poster) {
      return new Response(null, { status: 404, headers: NO_STORE_HEADERS });
    }

    const extension = extensionForMimeType(poster.mimeType);

    if (!extension) {
      return new Response(null, { status: 404, headers: NO_STORE_HEADERS });
    }

    return new Response(new Uint8Array(poster.data), {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        "Content-Type": poster.mimeType,
        "Content-Length": String(poster.data.byteLength),
        "Content-Disposition": `inline; filename="poster-${poster.id}.${extension}"`,
      },
    });
  } catch {
    // Never expose filesystem paths, adapter details, or storage errors.
    console.error("Poster delivery failed.");
    return new Response(null, { status: 500, headers: NO_STORE_HEADERS });
  }
}
