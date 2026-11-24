import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import type { ClubSummary } from "@/server/dashboards/queries";

type SwitcherClub = Pick<ClubSummary, "id" | "name"> & { status?: string };

export function ClubSwitcher({
  clubs,
  activeClubId,
  path,
}: {
  clubs: SwitcherClub[];
  activeClubId: string | null;
  path: string;
}) {
  if (clubs.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Club workspace" className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Club</span>
      {clubs.map((club) => (
        <Link
          key={club.id}
          href={`${path}?club=${club.id}`}
          className={buttonStyles({
            variant: club.id === activeClubId ? "primary" : "outline",
            size: "sm",
          })}
        >
          {club.name}
          {club.status !== "ACTIVE" ? <Badge variant="muted">{club.status}</Badge> : null}
        </Link>
      ))}
    </nav>
  );
}
