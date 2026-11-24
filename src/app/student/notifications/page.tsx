import type { Metadata } from "next";
import Link from "next/link";

import { DashboardPageHeader, SectionCard } from "@/components/dashboard/primitives";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/dashboards/actions";
import { ActionForm } from "@/features/dashboards/components/action-form";
import { NotificationPreferenceForm } from "@/features/dashboards/components/notification-preference-form";
import { formatDateTime, titleCase } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentNotifications } from "@/server/dashboards/queries";
import { getNotificationPreferences } from "@/services/notifications";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return typeof value === "string" ? value : undefined;
}

function notificationHref(filters: { filter?: string; type?: string; page?: number }) {
  const search = new URLSearchParams();
  if (filters.filter === "unread") search.set("filter", "unread");
  if (filters.type) search.set("type", filters.type);
  if (filters.page && filters.page > 1) search.set("page", String(filters.page));
  const query = search.toString();
  return `/student/notifications${query ? `?${query}` : ""}`;
}

export default async function StudentNotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("STUDENT");
  const params = await searchParams;
  const data = await getStudentNotifications(user, {
    filter: param(params, "filter"),
    type: param(params, "type"),
    page: Number(param(params, "page") ?? "1") || 1,
  });
  const preferences = await getNotificationPreferences(user);
  const unreadOnly = data.filters.filter === "unread";
  const activeType = data.filters.type;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Notifications"
        title="Updates from your campus."
        description="Registration changes, attendance updates, feedback availability, and other messages addressed to your account."
        actions={
          data.unread > 0 ? (
            <ActionForm
              action={markAllNotificationsReadAction}
              submitLabel={`Mark all read${data.unread ? ` (${data.unread})` : ""}`}
              variant="outline"
              showMessage={false}
            />
          ) : undefined
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.38fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={notificationHref({ type: activeType })}
              className={buttonStyles({ variant: unreadOnly ? "outline" : "primary", size: "sm" })}
            >
              All
            </Link>
            <Link
              href={notificationHref({ filter: "unread", type: activeType })}
              className={buttonStyles({ variant: unreadOnly ? "primary" : "outline", size: "sm" })}
            >
              Unread {data.unread ? `(${data.unread})` : ""}
            </Link>
            <span className="text-[11px] text-muted">
              {data.total} matching notification{data.total === 1 ? "" : "s"}
            </span>
          </div>

          <form
            method="get"
            className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-paper p-4 shadow-card"
          >
            {unreadOnly ? <input type="hidden" name="filter" value="unread" /> : null}
            <label className="min-w-56 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted">
                Notification type
              </span>
              <select
                name="type"
                defaultValue={activeType}
                className="mt-1 h-10 w-full rounded-md border border-line-strong bg-paper px-3 text-[12px] font-semibold text-ink focus:border-forest focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <option value="">All types</option>
                {data.typeCounts.map((item) => (
                  <option key={item.type} value={item.type}>
                    {titleCase(item.type)} ({item.count})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={buttonStyles({ variant: "outline", size: "md" })}>
              Filter
            </button>
            {activeType ? (
              <Link
                href={notificationHref({ filter: unreadOnly ? "unread" : undefined })}
                className={buttonStyles({ variant: "ghost", size: "md" })}
              >
                Clear type
              </Link>
            ) : null}
          </form>

          <div className="flex flex-wrap gap-2" aria-label="Notification type counts">
            {data.typeCounts.map((item) => (
              <Link
                key={item.type}
                href={notificationHref({
                  filter: unreadOnly ? "unread" : undefined,
                  type: item.type,
                })}
                className={
                  activeType === item.type
                    ? "rounded-full border border-forest bg-forest px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-paper"
                    : "rounded-full border border-line bg-paper px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted hover:border-forest/40 hover:text-forest"
                }
              >
                {titleCase(item.type)} {item.count}
              </Link>
            ))}
          </div>

          <SectionCard
            title={unreadOnly ? "Unread notifications" : "All notifications"}
            description={
              data.unread ? `${data.unread} unread across all types` : "You are all caught up."
            }
            bodyClassName="p-0 sm:p-0"
          >
            {data.notifications.length ? (
              <ul className="divide-y divide-line">
                {data.notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className={notification.readAt ? "bg-paper" : "bg-signal/5"}
                  >
                    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={notification.readAt ? "muted" : "signal"}>
                            {notification.readAt ? "Read" : "Unread"}
                          </Badge>
                          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                            {titleCase(notification.type)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold leading-5 text-ink">
                          {notification.title}
                        </p>
                        <p className="mt-1 text-[13px] leading-6 text-muted">{notification.body}</p>
                        <p className="mt-2 text-[11px] text-muted">
                          {formatDateTime(notification.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {notification.actionUrl ? (
                          <Link
                            href={notification.actionUrl}
                            className={buttonStyles({ variant: "outline", size: "sm" })}
                          >
                            Open
                          </Link>
                        ) : null}
                        {!notification.readAt ? (
                          <ActionForm
                            action={markNotificationReadAction}
                            fields={{ notificationId: notification.id }}
                            submitLabel="Mark read"
                            variant="ghost"
                            size="sm"
                            showMessage={false}
                          />
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <EmptyState
                  title={
                    unreadOnly
                      ? "No unread notifications"
                      : activeType
                        ? "No notifications of this type"
                        : "You're all caught up"
                  }
                  description={
                    unreadOnly
                      ? "Everything addressed to you has been read."
                      : activeType
                        ? "Try another notification type or clear the filter."
                        : "CampusPulse will show registration and event updates here when there is something new."
                  }
                />
              </div>
            )}

            {data.totalPages > 1 ? (
              <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
                {data.page > 1 ? (
                  <Link
                    href={notificationHref({
                      filter: data.filters.filter,
                      type: activeType,
                      page: data.page - 1,
                    })}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-[11px] text-muted">
                  Page {data.page} of {data.totalPages}
                </span>
                {data.page < data.totalPages ? (
                  <Link
                    href={notificationHref({
                      filter: data.filters.filter,
                      type: activeType,
                      page: data.page + 1,
                    })}
                    className={buttonStyles({ variant: "outline", size: "sm" })}
                  >
                    Next
                  </Link>
                ) : (
                  <span />
                )}
              </div>
            ) : null}
          </SectionCard>
        </div>

        <aside>
          <SectionCard
            title="Notification preferences"
            description="Choose which in-app notifications you receive. Changes are saved to the database."
          >
            <NotificationPreferenceForm initial={preferences} />
          </SectionCard>
        </aside>
      </div>
    </div>
  );
}
