/**
 * Maximum allowed poster file size in bytes.
 *
 * Calibrated to 4.2 MB (4,404,019 bytes) to leave headroom for multipart/form-data
 * boundaries, CSRF tokens, and metadata fields within serverless request limits
 * (such as Vercel Hobby's 4.5 MB request body ceiling).
 */
export const POSTER_MAX_BYTES = Math.floor(4.2 * 1024 * 1024);

export function posterUrl(posterId: string): string {
  return `/api/posters/${encodeURIComponent(posterId)}`;
}

export function posterAltText(altText: string | null | undefined, eventTitle: string): string {
  const trimmed = altText?.trim();
  return trimmed ? trimmed : `${eventTitle} poster`;
}
