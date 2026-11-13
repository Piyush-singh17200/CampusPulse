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
import { formatDateTime } from "@/lib/format";
import { requireDashboardRole } from "@/server/auth/page-guard";
import { getStudentNotifications } from "@/server/dashboards/queries";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function StudentNotificationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireDashboardRole("STUDENT");
  const params = await searchParams;
  const unreadOnly = params.filter === "unread";
  const data = await getStudentNotifications(user);
  const notifications = unreadOnly
    ? data.notifications.filter((item) => !item.readAt)
    : data.notifications;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Notifications"
        title="Updates from your campus."
        description="Registration changes, event approvals, and other messages addressed to your account."
        actions={
          data.unread > 0 ? (
            <ActionForm
              action={markAllNotificationsReadAction}
              submitLabel="Mark all read"
              variant="outline"
              showMessage={false}
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/student/notifications"
          className={buttonStyles({ variant: unreadOnly ? "outline" : "primary", size: "sm" })}
        >
          All
        </Link>
        <Link
          href="/student/notifications?filter=unread"
          className={buttonStyles({ variant: unreadOnly ? "primary" : "outline", size: "sm" })}
        >
          Unread {data.unread ? `(${data.unread})` : ""}
        </Link>
      </div>

      <SectionCard
        title={unreadOnly ? "Unread notifications" : "All notifications"}
        description={data.unread ? `${data.unread} unread` : "You are all caught up."}
        bodyClassName="p-0 sm:p-0"
      >
        {notifications.length ? (
          <ul className="divide-y divide-line">
            {notifications.map((notification) => (
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
                        {notification.type.toLowerCase().replaceAll("_", " ")}
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
              title={unreadOnly ? "No unread notifications" : "You're all caught up"}
              description={
                unreadOnly
                  ? "Everything addressed to you has been read."
                  : "CampusPulse will show registration and event updates here when there is something new."
              }
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
