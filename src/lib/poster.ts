export function posterUrl(posterId: string): string {
  return `/api/posters/${encodeURIComponent(posterId)}`;
}

export function posterAltText(altText: string | null | undefined, eventTitle: string): string {
  const trimmed = altText?.trim();
  return trimmed ? trimmed : `${eventTitle} poster`;
}
