import Link from "next/link";
import { Compass, Route, Calendar, MapPin, UserRound, Lock, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EmptyState, ErrorState } from "@/components/club/StateMessage";
import {
  DifficultyBadge,
  StatusIndicator,
  type DriveDifficulty,
  type DriveStatus,
} from "@/components/club/DriveBadges";
import { formatDate } from "@/lib/format";
import { CLUB_CONFIG } from "@/lib/constants";

type Drive = {
  id: string;
  drive_id_code: string;
  title: string;
  difficulty: DriveDifficulty;
  status: DriveStatus;
  drive_date: string;
  location: string;
  target_rank: number;
  lead_marshal: { username: string; full_name: string | null } | null;
};

function DriveCardContent({ drive }: { drive: Drive }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs font-medium tracking-wide text-charcoal-light/60 uppercase">
          {drive.drive_id_code}
        </span>
        <DifficultyBadge difficulty={drive.difficulty} />
      </div>

      <h2 className="text-lg font-semibold text-charcoal">{drive.title}</h2>

      <div className="flex flex-col gap-2 text-sm text-charcoal-light/90">
        <StatusIndicator status={drive.status} />
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 shrink-0 text-charcoal-light/60" />
          {formatDate(drive.drive_date)}
        </span>
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-charcoal-light/60" />
          {drive.location}
        </span>
        {drive.lead_marshal && (
          <span className="flex items-center gap-1.5">
            <UserRound className="h-4 w-4 shrink-0 text-charcoal-light/60" />
            Led by{" "}
            {drive.lead_marshal.full_name ?? drive.lead_marshal.username}
          </span>
        )}
      </div>
    </>
  );
}

/** `null` userRank means signed out — treated as below every rank requirement. */
function DriveCard({
  drive,
  userRank,
}: {
  drive: Drive;
  userRank: number | null;
}) {
  const isLocked = userRank === null || userRank < drive.target_rank;

  if (!isLocked) {
    return (
      <Link
        href={`/drives/${drive.id}`}
        className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <DriveCardContent drive={drive} />
      </Link>
    );
  }

  const requiredRank = CLUB_CONFIG.ranks.find(
    (r) => r.level === drive.target_rank,
  );

  return (
    <div
      aria-disabled="true"
      className="flex cursor-not-allowed flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 opacity-60 grayscale-[35%]"
    >
      <DriveCardContent drive={drive} />
      <span className="flex items-center gap-1.5 rounded-full bg-sand-light px-2.5 py-1 text-xs font-semibold text-charcoal-light/80">
        <Lock className="h-3.5 w-3.5" />
        {userRank === null
          ? "Sign in to check eligibility"
          : `Locked: Required Rank ${requiredRank?.title ?? drive.target_rank}`}
      </span>
    </div>
  );
}

export default async function DrivesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRank: number | null = null;
  let isMarshal = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_rank, is_marshal")
      .eq("id", user.id)
      .single();
    userRank = profile?.current_rank ?? null;
    isMarshal = profile?.is_marshal ?? false;
  }

  const { data, error } = await supabase
    .from("drives")
    .select(
      "id, drive_id_code, title, difficulty, status, drive_date, location, target_rank, lead_marshal:profiles(username, full_name)",
    )
    .order("drive_date", { ascending: false })
    .overrideTypes<Drive[], { merge: false }>();

  const drives = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
              <Compass className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal">
              Official Drives
            </h1>
          </div>
          <p className="text-sm text-charcoal-light/80">
            Club-organized off-road runs — past and upcoming.
          </p>
        </div>
        {isMarshal && (
          <Link
            href="/drives/new"
            className="flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark"
          >
            <Plus className="h-4 w-4" />
            Post a Drive
          </Link>
        )}
      </header>

      {error ? (
        <ErrorState message="Couldn't load drives right now. Please try again shortly." />
      ) : drives.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No drives yet"
          message="Official drives will show up here once a marshal schedules one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {drives.map((drive) => (
            <DriveCard key={drive.id} drive={drive} userRank={userRank} />
          ))}
        </div>
      )}
    </div>
  );
}
