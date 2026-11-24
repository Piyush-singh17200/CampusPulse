import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

type Option = { id: string; name: string; slug?: string };
type EventOption = { id: string; title: string; startsAt: Date };
type FilterValues = {
  from?: string;
  to?: string;
  eventId?: string;
  category?: string;
  clubId?: string;
  status?: string;
};

const inputClass =
  "mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest";

export function AnalyticsFilterForm({
  action,
  filters,
  clubs = [],
  categories = [],
  events = [],
  showClub = false,
  showEvent = true,
  showCategory = true,
  showStatus = true,
  clubPlaceholder = "All clubs",
  requireClub = false,
  resetHref,
  hidden = {},
}: {
  action: string;
  filters: FilterValues;
  clubs?: Option[];
  categories?: Option[];
  events?: EventOption[];
  showClub?: boolean;
  showEvent?: boolean;
  showCategory?: boolean;
  showStatus?: boolean;
  clubPlaceholder?: string;
  requireClub?: boolean;
  resetHref: string;
  hidden?: Record<string, string | undefined>;
}) {
  return (
    <form
      method="get"
      action={action}
      className="rounded-xl border border-line bg-paper p-4 shadow-card"
      aria-label="Analytics filters"
    >
      {Object.entries(hidden).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">From</span>
          <input type="date" name="from" defaultValue={filters.from} className={inputClass} />
        </label>
        <label>
          <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">To</span>
          <input type="date" name="to" defaultValue={filters.to} className={inputClass} />
        </label>

        {showClub ? (
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              Club
            </span>
            <select
              name="clubId"
              defaultValue={filters.clubId ?? ""}
              className={inputClass}
              required={requireClub}
            >
              <option value="">{clubPlaceholder}</option>
              {clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showEvent ? (
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              Event
            </span>
            <select name="eventId" defaultValue={filters.eventId ?? ""} className={inputClass}>
              <option value="">All events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} · {formatDate(event.startsAt)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showCategory ? (
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              Category
            </span>
            <select name="category" defaultValue={filters.category ?? ""} className={inputClass}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {showStatus ? (
          <label>
            <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
              Event status
            </span>
            <select name="status" defaultValue={filters.status ?? ""} className={inputClass}>
              <option value="">All statuses</option>
              {["DRAFT", "PENDING_APPROVAL", "PUBLISHED", "REJECTED", "CANCELLED", "COMPLETED"].map(
                (status) => (
                  <option key={status} value={status}>
                    {status
                      .toLowerCase()
                      .split("_")
                      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                      .join(" ")}
                  </option>
                ),
              )}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="submit" className={buttonStyles({ variant: "signal", size: "sm" })}>
          Apply filters
        </button>
        <Link href={resetHref} className={buttonStyles({ variant: "ghost", size: "sm" })}>
          Reset
        </Link>
        <p className="text-[11px] leading-5 text-muted">
          Filters are validated on the server and scoped to your authorized dashboard.
        </p>
      </div>
    </form>
  );
}
