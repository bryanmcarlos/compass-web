"use client";

import { useState } from "react";
import { RankBadge } from "./RankBadge";
import type { RankName } from "@/lib/constants";

/** Defaults to the historical rank a driver held at registration time;
 * press-and-hold temporarily reveals their current live profile rank,
 * reverting the instant it's released. When there's no historical rank on
 * file (legacy rows predating the driver_rank column), there's nothing to
 * hold toward — it just always shows the live rank, no-op handlers. */
export function HoldToRevealRankBadge({
  historicalRank,
  liveRank,
  className,
  size,
}: {
  historicalRank: RankName | null;
  liveRank: RankName;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const [revealed, setRevealed] = useState(false);
  const hasHistory = historicalRank !== null;
  const displayRank = hasHistory && !revealed ? historicalRank : liveRank;

  return (
    <span
      onPointerDown={() => hasHistory && setRevealed(true)}
      onPointerUp={() => setRevealed(false)}
      onPointerLeave={() => setRevealed(false)}
      onPointerCancel={() => setRevealed(false)}
      title={hasHistory ? "Hold to see current rank" : undefined}
      // The caller's className is a mix of layout (ml-auto, shrink-0 — needs
      // to land on whichever element is actually the flex item in the
      // parent row, i.e. this wrapper) and typography (text-[11px] — needs
      // to reach RankBadge's own span, which sets its own text-xs default
      // that would otherwise win over an inherited size). Applying it to
      // both is redundant but harmless — layout classes on the inner badge
      // span are inert no-ops since it isn't itself a flex item there.
      className={`touch-none select-none ${className ?? ""}`}
    >
      <RankBadge rank={displayRank} className={className} size={size} />
    </span>
  );
}
