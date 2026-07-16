import { ShieldCheck } from "lucide-react";
import { CLUB_CONFIG } from "@/lib/constants";

export function RankBadge({
  rank,
  className = "text-xs",
  iconClassName = "h-3.5 w-3.5",
}: {
  rank: number;
  className?: string;
  iconClassName?: string;
}) {
  const clamped = Math.min(Math.max(Math.round(rank), 1), 5) as
    | 1
    | 2
    | 3
    | 4
    | 5;
  const rankConfig = CLUB_CONFIG.ranks.find((r) => r.level === clamped);

  return (
    <span
      style={{ color: `var(${rankConfig?.colorVar ?? "--color-forest"})` }}
      className={`inline-flex items-center gap-1 font-semibold ${className}`}
    >
      <ShieldCheck className={iconClassName} />
      {rankConfig?.title ?? `Tier ${clamped}`}
    </span>
  );
}
