"use client";

import { DashboardRouteError } from "@/features/dashboards/components/route-error";

export default function CollegeFeedbackError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardRouteError error={error} reset={reset} />;
}
