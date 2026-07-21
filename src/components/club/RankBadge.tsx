import type { RankName } from "@/lib/constants";

// Asset filenames are lowercase/abbreviated ("advance") and don't always
// match the real rank title ("Advanced") — this table is the one place that
// mismatch is handled, so no call site needs to know about it.
const RANK_BADGE_SRC: Record<RankName, string> = {
  General: "/badges/badge-general.png",
  Member: "/badges/badge-general.png",
  Newbie: "/badges/badge-newbie.png",
  Rookie: "/badges/badge-rookie.png",
  Intermediate: "/badges/badge-intermediate.png",
  Advanced: "/badges/badge-advance.png",
  Marshal: "/badges/badge-marshal.png",
};

const SIZE_CLASSES = {
  xs: "h-4 w-4",
  sm: "h-5 w-5",
  md: "h-6 w-6",
  lg: "h-8 w-8",
} as const;

export function RankBadge({
  rank,
  size = "sm",
  showLabel = true,
  className = "text-xs",
}: {
  /** null/undefined or any string not in RANK_BADGE_SRC falls back to the
   * "General" badge — this is the "graceful fallback for unknown rank"
   * behavior, not an error state. */
  rank: RankName | string | null | undefined;
  size?: keyof typeof SIZE_CLASSES;
  showLabel?: boolean;
  className?: string;
}) {
  const rankName: RankName = rank && rank in RANK_BADGE_SRC ? (rank as RankName) : "General";

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold text-charcoal ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed local static asset, same convention as Avatar's default image */}
      <img
        src={RANK_BADGE_SRC[rankName]}
        alt={`${rankName} rank badge`}
        className={`${SIZE_CLASSES[size]} shrink-0 object-contain`}
      />
      {showLabel && rankName}
    </span>
  );
}
