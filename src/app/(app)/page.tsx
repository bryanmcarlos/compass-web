import type { ComponentType } from "react";
import {
  Compass,
  Layers,
  Users,
  Route,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { Logo } from "@/components/club/Logo";
import { CLUB_CONFIG, type RankLevel } from "@/lib/constants";

type RankTier = RankLevel & { members: number };

type ClubDashboardData = {
  tiers: RankTier[];
  totalMembers: number;
  officialDrives: number;
  clubActivities: number;
};

/**
 * Placeholder Server Component data fetch. Swap for a real Supabase query
 * once member counts are tracked, e.g.:
 *   const supabase = await createClient();
 *   const { data } = await supabase.from("profiles").select("current_rank");
 * Rank titles/colors themselves are never hardcoded here — they come from
 * `CLUB_CONFIG.ranks`, this function only supplies the per-rank counts.
 */
async function getClubDashboardData(): Promise<ClubDashboardData> {
  const memberCountByRank: Record<number, number> = {
    1: 75,
    2: 30,
    3: 15,
    4: 10,
    5: 7,
  };

  const tiers: RankTier[] = CLUB_CONFIG.ranks.map((rank) => ({
    ...rank,
    members: memberCountByRank[rank.level] ?? 0,
  }));

  const totalMembers = tiers.reduce((sum, t) => sum + t.members, 0);

  return {
    tiers,
    totalMembers,
    officialDrives: 8,
    clubActivities: 4,
  };
}

export default async function Home() {
  const data = await getClubDashboardData();
  const maxTierMembers = Math.max(...data.tiers.map((t) => t.members));

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

      <section className="rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8">
        <header className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sand-light text-forest">
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
              <li key={t.level} className="group">
                <div className="mb-1.5 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-charcoal">
                    <span className="mr-2 text-xs font-semibold text-charcoal-light/60">
                      T{t.level}
                    </span>
                    {t.title}
                  </span>
                  <span className="font-semibold text-charcoal tabular-nums">
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

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile icon={Users} label="Total Members" value={data.totalMembers} />
        <StatTile icon={Route} label="Official Drives" value={data.officialDrives} />
        <StatTile
          icon={CalendarDays}
          label="Club Activities"
          value={data.clubActivities}
        />
        <StatTile icon={ShieldCheck} label={seniorLabel} value={seniorMembers} />
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest/10 text-forest">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-2xl font-semibold text-charcoal">
          {value.toLocaleString()}
        </p>
        <p className="text-sm text-charcoal-light/80">{label}</p>
      </div>
    </div>
  );
}
