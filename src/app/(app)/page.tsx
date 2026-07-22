import type { ComponentType } from "react";
import { Compass, Layers, Users, Route, FileText, ShieldCheck, Megaphone } from "lucide-react";
import { Logo } from "@/components/club/Logo";
import { LikeButton } from "@/components/club/LikeButton";
import { createClient } from "@/utils/supabase/server";
import { CLUB_CONFIG, type RankLevel } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { toggleAnnouncementReaction } from "./announcements/actions";

type RankTier = RankLevel & { members: number };

type ClubDashboardData = {
  tiers: RankTier[];
  totalMembers: number;
  totalTripReports: number;
  scheduledDrives: number;
};

async function getClubDashboardData(): Promise<ClubDashboardData> {
  const supabase = await createClient();

  // Rank distribution has no cheap GROUP BY over PostgREST, so this pulls
  // just the one column for every profile (a few hundred rows, ~KB of JSON)
  // and tallies it in JS — same "fetch narrow, aggregate in code" pattern
  // this app already uses elsewhere (e.g. the profile page's skill tally).
  const [{ data: rankRows }, { count: totalMembers }, { count: totalTripReports }, { count: scheduledDrives }] =
    await Promise.all([
      supabase.from("profiles").select("current_rank"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("trip_reports").select("id", { count: "exact", head: true }),
      supabase
        .from("drives")
        .select("id", { count: "exact", head: true })
        .eq("status", "Scheduled"),
    ]);

  const memberCountByRank: Record<number, number> = {};
  for (const row of rankRows ?? []) {
    memberCountByRank[row.current_rank] = (memberCountByRank[row.current_rank] ?? 0) + 1;
  }

  const tiers: RankTier[] = CLUB_CONFIG.ranks.map((rank) => ({
    ...rank,
    members: memberCountByRank[rank.level] ?? 0,
  }));

  return {
    tiers,
    totalMembers: totalMembers ?? 0,
    totalTripReports: totalTripReports ?? 0,
    scheduledDrives: scheduledDrives ?? 0,
  };
}

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  category: string;
  published_at: string;
  likeCount: number;
  viewerLiked: boolean;
};

/** A minimal first pass at surfacing announcements at all — nothing has
 * ever rendered this table before (it's only ever been written to, by the
 * promotion-celebration features). Filtered to the viewer's own rank or
 * below, same target_rank convention the rest of the app uses. */
async function getRecentAnnouncements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerRank: number,
  viewerId: string | null,
): Promise<AnnouncementRow[]> {
  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, content, category, target_rank, published_at")
    .lte("target_rank", viewerRank)
    .order("published_at", { ascending: false })
    .limit(5);

  const rows = announcements ?? [];
  if (rows.length === 0) return [];

  const { data: reactionRows } = await supabase
    .from("announcement_reactions")
    .select("announcement_id, user_id")
    .in(
      "announcement_id",
      rows.map((r) => r.id),
    );

  const summaryByAnnouncement = new Map<string, { count: number; liked: boolean }>();
  for (const row of reactionRows ?? []) {
    const summary = summaryByAnnouncement.get(row.announcement_id) ?? { count: 0, liked: false };
    summary.count += 1;
    if (viewerId && row.user_id === viewerId) summary.liked = true;
    summaryByAnnouncement.set(row.announcement_id, summary);
  }

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    published_at: r.published_at,
    likeCount: summaryByAnnouncement.get(r.id)?.count ?? 0,
    viewerLiked: summaryByAnnouncement.get(r.id)?.liked ?? false,
  }));
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let viewerRank = 0;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_rank")
      .eq("id", user.id)
      .single();
    viewerRank = profile?.current_rank ?? 0;
  }

  const [data, announcements] = await Promise.all([
    getClubDashboardData(),
    getRecentAnnouncements(supabase, viewerRank, user?.id ?? null),
  ]);
  const maxTierMembers = Math.max(...data.tiers.map((t) => t.members), 1);

  const [seniorRank, secondSeniorRank] = [...CLUB_CONFIG.ranks].sort(
    (a, b) => b.level - a.level,
  );
  const seniorMembers =
    (data.tiers.find((t) => t.level === seniorRank.level)?.members ?? 0) +
    (data.tiers.find((t) => t.level === secondSeniorRank.level)?.members ??
      0);
  const seniorLabel = `${seniorRank.title} + ${secondSeniorRank.title}`;

  return (
    <div className="flex flex-col gap-8">
      <section className="relative overflow-hidden rounded-2xl border border-sand shadow-sm">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[url('/defaults/desert-banner.svg')] bg-cover bg-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-forest-dark/90 via-forest/85 to-forest-dark/95"
        />
        <div className="relative flex flex-col items-center gap-3 px-6 py-10 text-center sm:px-10 sm:py-14">
          <Logo variant="dark" className="h-10 w-auto sm:h-12" />
          <span className="mt-1 flex items-center gap-2 rounded-full bg-off-white/10 px-4 py-1.5 text-xs font-medium tracking-[0.2em] text-off-white/80 uppercase">
            <Compass className="h-4 w-4" />
            Est. Community
          </span>
          <p className="max-w-xl text-sm font-medium text-off-white/80 sm:text-base">
            {CLUB_CONFIG.metadata.tagline}
          </p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-semibold tracking-wide text-off-white/80 uppercase sm:text-sm">
            {CLUB_CONFIG.metadata.pillars.map((pillar, i) => (
              <span key={pillar} className="flex items-center gap-x-2">
                {i > 0 && <span aria-hidden="true">•</span>}
                <span>{pillar}</span>
              </span>
            ))}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-sand bg-gradient-to-br from-off-white to-sand-light/30 p-6 shadow-sm sm:p-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-light text-forest">
            <Layers className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-charcoal">
              Club Rank Distribution
            </h2>
            <p className="text-sm text-charcoal-light/80">
              Members by driver tier
            </p>
          </div>
        </header>

        <ul className="flex flex-col gap-4">
          {data.tiers.map((t) => {
            const widthPct = (t.members / maxTierMembers) * 100;
            return (
              <li key={t.level} className="group min-w-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium text-charcoal">
                    <span className="mr-2 text-xs font-semibold text-charcoal-light/60">
                      T{t.level}
                    </span>
                    {t.title}
                  </span>
                  <span className="shrink-0 font-semibold text-charcoal tabular-nums">
                    {t.members}
                  </span>
                </div>
                <div className="h-4 w-full rounded-md bg-sand-light">
                  <div
                    className="h-full rounded-r-md transition-[width,filter] duration-300 group-hover:brightness-110"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: `var(${t.colorVar})`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {announcements.length > 0 && (
        <section className="rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8">
          <header className="mb-6 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-light text-forest">
              <Megaphone className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-charcoal">Recent Announcements</h2>
              <p className="text-sm text-charcoal-light/80">
                Promotions and club-wide news
              </p>
            </div>
          </header>

          <ul className="flex flex-col gap-4">
            {announcements.map((a, index) => (
              <li
                key={a.id}
                className={`flex flex-col gap-2 ${index === 0 ? "" : "border-t border-sand pt-4"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest uppercase">
                    {a.category}
                  </span>
                  <span className="text-xs text-charcoal-light/60">
                    {formatRelativeTime(a.published_at)}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-charcoal">{a.title}</h3>
                <p className="text-sm break-words text-charcoal-light/90">{a.content}</p>
                <div>
                  <LikeButton
                    initialLiked={a.viewerLiked}
                    initialCount={a.likeCount}
                    toggleAction={toggleAnnouncementReaction.bind(null, a.id)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          icon={Users}
          label="Total Members"
          value={data.totalMembers}
          accent="primary"
        />
        <StatTile icon={FileText} label="Trip Reports" value={data.totalTripReports} />
        <StatTile icon={Route} label="Scheduled Drives" value={data.scheduledDrives} />
        <StatTile icon={ShieldCheck} label={seniorLabel} value={seniorMembers} />
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent = "forest",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent?: "forest" | "primary";
}) {
  const iconBg = accent === "primary" ? "bg-primary/10" : "bg-forest/10";
  const iconFg = accent === "primary" ? "text-primary" : "text-forest";
  const glow = accent === "primary" ? "bg-primary/25" : "bg-forest/25";
  const hoverBorder = accent === "primary" ? "hover:border-primary/40" : "hover:border-forest/40";

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-sand bg-gradient-to-br from-off-white to-sand-light/50 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${hoverBorder}`}
    >
      {/* Decorative only — a soft blurred accent that appears on hover, never
          carries meaning on its own (the icon + label + value already do). */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full ${glow} opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100`}
      />
      <div className="relative flex flex-col gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg} ${iconFg}`}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          {/* Proportional figures (not tabular-nums) — this is a standalone
              display value, not a column of numbers that need to align. */}
          <p className="text-2xl font-semibold text-charcoal">
            {value.toLocaleString()}
          </p>
          <p className="truncate text-xs font-semibold tracking-wider text-charcoal-light/60 uppercase">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}
