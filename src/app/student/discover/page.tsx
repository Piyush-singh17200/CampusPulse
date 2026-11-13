import type { Metadata } from "next";
import Link from "next/link";

import { DashboardEventCard } from "@/components/dashboard/event-card";
import { DashboardPageHeader } from "@/components/dashboard/primitives";
import { buttonStyles } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import {
  registerForEventAction,
  saveEventAction,
  unsaveEventAction,
} from "@/features/dashboards/actions";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { discoverEvents } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Discover events",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

function pageNumber(value: string | string[] | undefined): number {
  const parsed = Number(single(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function pageHref(
  filters: { q: string; category: string; dateFrom: string; dateTo: string },
  page: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/student/discover?${query}` : "/student/discover";
}

export default async function StudentDiscoverPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("STUDENT");
  const params = await searchParams;
  const filters = {
    q: single(params.q),
    category: single(params.category),
    dateFrom: single(params.dateFrom),
    dateTo: single(params.dateTo),
    page: pageNumber(params.page),
  };
  const result = await discoverEvents(user, filters);

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Discover"
        title="Find your next campus moment."
        description="Search published events from active clubs in your college. Filters apply to the event start date."
      />

      <form
        method="get"
        className="grid gap-3 rounded-xl border border-line bg-paper p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end"
      >
        <Field id="discover-q" label="Search">
          <Input
            id="discover-q"
            name="q"
            type="search"
            defaultValue={result.filters.q}
            placeholder="Title, club, or keyword"
          />
        </Field>
        <Field id="discover-category" label="Category">
          <Select id="discover-category" name="category" defaultValue={result.filters.category}>
            <option value="">All categories</option>
            {result.categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="discover-from" label="From">
          <Input
            id="discover-from"
            name="dateFrom"
            type="date"
            defaultValue={result.filters.dateFrom}
          />
        </Field>
        <Field id="discover-to" label="To">
          <Input id="discover-to" name="dateTo" type="date" defaultValue={result.filters.dateTo} />
        </Field>
        <div className="flex gap-2">
          <button type="submit" className={buttonStyles({ className: "h-11" })}>
            Apply
          </button>
          <Link
            href="/student/discover"
            className={buttonStyles({ variant: "outline", className: "h-11" })}
          >
            Reset
          </Link>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          {result.total} event{result.total === 1 ? "" : "s"} found
        </p>
        {result.filters.q ||
        result.filters.category ||
        result.filters.dateFrom ||
        result.filters.dateTo ? (
          <p className="text-xs text-muted">Filters are active.</p>
        ) : null}
      </div>

      {result.events.length ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.events.map((event) => {
              const saved = result.savedEventIds.has(event.id);
              const registered = result.registeredEventIds.has(event.id);

              return (
                <DashboardEventCard
                  key={event.id}
                  event={event}
                  href={`/student/events/${event.id}`}
                  saved={saved}
                  registered={registered}
                  action={
                    <div className="flex w-full flex-wrap items-center gap-2">
                      <Link
                        href={`/student/events/${event.id}`}
                        className={buttonStyles({ variant: "outline", size: "sm" })}
                      >
                        Details
                      </Link>
                      <ActionForm
                        action={saved ? unsaveEventAction : saveEventAction}
                        fields={{ eventId: event.id }}
                        submitLabel={saved ? "Unsave" : "Save"}
                        variant="ghost"
                        size="sm"
                        showMessage={false}
                      />
                      {!registered ? (
                        <ActionForm
                          action={registerForEventAction}
                          fields={{ eventId: event.id }}
                          submitLabel="Register"
                          variant="signal"
                          size="sm"
                          showMessage={false}
                        />
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </div>

          {result.totalPages > 1 ? (
            <nav
              aria-label="Discovery pagination"
              className="flex items-center justify-between gap-3 border-t border-line pt-5"
            >
              {result.page > 1 ? (
                <Link
                  href={pageHref(result.filters, result.page - 1)}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <p className="text-xs font-semibold text-muted">
                Page {result.page} of {result.totalPages}
              </p>
              {result.page < result.totalPages ? (
                <Link
                  href={pageHref(result.filters, result.page + 1)}
                  className={buttonStyles({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="No events match this search"
          description="Try a broader keyword, remove a date filter, or check back after clubs publish their next events."
          action={
            <Link href="/student/discover" className={buttonStyles({ size: "sm" })}>
              Clear filters
            </Link>
          }
        />
      )}
    </div>
  );
}
