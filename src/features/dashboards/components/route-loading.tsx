export function DashboardRouteLoading({ label }: { label: string }) {
  return (
    <div className="space-y-4" role="status" aria-label={label}>
      <div className="h-24 animate-pulse rounded-xl border border-line bg-paper" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-line bg-paper" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-line bg-paper" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
