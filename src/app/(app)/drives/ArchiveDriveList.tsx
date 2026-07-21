"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { RankBadge } from "@/components/club/RankBadge";
import { StatusIndicator, type DriveStatus } from "@/components/club/DriveBadges";
import { rankNameFromLevel, CLUB_CONFIG, type RankName } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export type ArchiveDrive = {
  id: string;
  drive_id_code: string;
  title: string;
  location: string;
  drive_date: string;
  target_rank: number;
  status: DriveStatus;
};

const RANK_FILTERS: RankName[] = CLUB_CONFIG.ranks.map((r) => r.title as RankName);

/** Client-side search + filter over the full archive row set rather than a
 * server round trip per keystroke — at ~500 rows of a handful of thin
 * fields each, the whole set is tens of KB, trivially small to filter
 * in-browser with zero latency versus adding real input lag for no benefit
 * at this scale. */
export function ArchiveDriveList({
  drives,
  unknownDateCount,
}: {
  drives: ArchiveDrive[];
  unknownDateCount: number;
}) {
  const [query, setQuery] = useState("");
  const [rankFilter, setRankFilter] = useState<RankName | "All">("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drives.filter((d) => {
      const matchesQuery =
        !q || d.title.toLowerCase().includes(q) || d.location.toLowerCase().includes(q);
      const matchesRank = rankFilter === "All" || rankNameFromLevel(d.target_rank) === rankFilter;
      return matchesQuery && matchesRank;
    });
  }, [drives, query, rankFilter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or location…"
            className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
        <select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value as RankName | "All")}
          className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none sm:w-48"
        >
          <option value="All">All Ranks</option>
          {RANK_FILTERS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand px-5 py-8 text-center text-sm text-charcoal-light/70">
          No drives match your search.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {filtered.map((drive) => (
            <li key={drive.id}>
              <Link
                href={`/drives/${drive.id}`}
                className="flex items-center gap-3 rounded-lg border border-sand bg-off-white px-3 py-2 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="hidden font-mono text-xs text-charcoal-light/50 uppercase sm:inline">
                  {drive.drive_id_code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-charcoal">
                    {drive.title}
                  </span>
                  <span className="block truncate text-xs text-charcoal-light/60">
                    {drive.location} · {formatDate(drive.drive_date)}
                  </span>
                </span>
                {drive.status === "Cancelled" && (
                  <StatusIndicator status={drive.status} className="shrink-0 text-[11px]" />
                )}
                <RankBadge
                  rank={rankNameFromLevel(drive.target_rank)}
                  size="xs"
                  className="shrink-0 text-[11px]"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {unknownDateCount > 0 && (
        <p className="text-center text-xs text-charcoal-light/50">
          +{unknownDateCount} drive{unknownDateCount === 1 ? "" : "s"} with an unknown date not
          shown above.
        </p>
      )}
    </div>
  );
}
