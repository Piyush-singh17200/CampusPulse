"use client";

import { DashboardRouteError } from "@/features/dashboards/components/route-error";

export default function StudentNotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardRouteError error={error} reset={reset} />;
}
