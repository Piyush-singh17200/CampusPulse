import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";

const variants: Record<
  string,
  "default" | "outline" | "signal" | "forest" | "sage" | "dark" | "muted"
> = {
  ACTIVE: "forest",
  PUBLISHED: "forest",
  APPROVED: "forest",
  CONFIRMED: "forest",
  ATTENDED: "forest",
  PENDING: "signal",
  PENDING_APPROVAL: "signal",
  DRAFT: "muted",
  INVITED: "signal",
  SUSPENDED: "signal",
  REJECTED: "signal",
  CANCELLED: "signal",
  DISABLED: "muted",
  ARCHIVED: "muted",
  COMPLETED: "sage",
  NO_SHOW: "muted",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={variants[status] ?? "outline"}>{titleCase(status)}</Badge>;
}
