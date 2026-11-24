export type AnalyticsQuery = {
  from?: string;
  to?: string;
  eventId?: string;
  category?: string;
  clubId?: string;
  status?: string;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export function stringParam(params: SearchParamsInput, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

export function analyticsQueryFromParams(params: SearchParamsInput): AnalyticsQuery {
  return {
    from: stringParam(params, "from"),
    to: stringParam(params, "to"),
    eventId: stringParam(params, "eventId"),
    category: stringParam(params, "category"),
    clubId: stringParam(params, "clubId") ?? stringParam(params, "club"),
    status: stringParam(params, "status"),
  };
}

export function analyticsQueryString(filters: AnalyticsQuery): string {
  const params = new URLSearchParams();

  for (const key of ["from", "to", "eventId", "category", "clubId", "status"] as const) {
    const value = filters[key];
    if (value) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
