import Link from "next/link";
import { Compass, Route, Calendar, Clock, MapPin, UserRound, Lock, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EmptyState, ErrorState } from "@/components/club/StateMessage";
import { RankBadge } from "@/components/club/RankBadge";
import { Tabs } from "@/components/club/Tabs";
import { ArchiveDriveList, type ArchiveDrive } from "./ArchiveDriveList";
import { SwipeToDeleteRow } from "@/components/club/SwipeToDeleteRow";
import { formatDate, formatTime, formatConvoyStatus } from "@/lib/format";
import { CLUB_CONFIG, rankNameFromLevel } from "@/lib/constants";
import { countsAsDriverSlot } from "@/lib/driveRoles";

const DRIVES_TABS = [
  { key: "upcoming", label: "Upcoming Runs" },
  { key: "completed", label: "Completed Last 5" },
  { key: "archive", label: "Completed Archive" },
];

// Three rows in the live data carry this Unix-epoch sentinel instead of a
// real drive_date — excluded from date-ordered queries and the Archive's
// default list/count rather than sorting to the top or silently vanishing
// (see ArchiveDriveList's "+N unknown-date" line).
const UNKNOWN_DATE_SENTINEL = "1970-01-01";

type UpcomingDrive = {
  id: string;
  drive_id_code: string;
  title: string;
  drive_date: string;
  drive_start_time: string | null;
  location: string;
  meeting_point_name: string | null;
  target_rank: number;
  allowed_ranks: string[];
  is_all_levels: boolean;
  max_drivers: number;
};

type CompletedDrive = {
  id: string;
  drive_id_code: string;
  title: string;
  drive_date: string;
  location: string;
  target_rank: number;
  max_drivers: number;
  lead_marshal: { username: string; full_name: string | null } | null;
};

/** Batches a single `.in("drive_id", ids)` count query instead of one query
 * per card — cheap regardless of tab size, and avoids an N+1 query pattern
 * for what's otherwise a handful of drives per tab. Counts Drivers plus
 * non-Marshal Support registrants (see countsAsDriverSlot) — matches the
 * same "active driver slot" figure shown on a drive's own detail page. */
async function driverCountsByDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driveIds: string[],
): Promise<Map<string, number>> {
  if (driveIds.length === 0) return new Map();
  const { data } = await supabase
    .from("drive_registrations")
    .select("drive_id, role, driver_rank, user:profiles(current_rank)")
    .in("role", ["Driver", "Support"])
    .in("drive_id", driveIds)
    .overrideTypes<
      { drive_id: string; role: "Driver" | "Support"; driver_rank: string | null; user: { current_rank: number } | null }[],
      { merge: false }
    >();

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!countsAsDriverSlot(row.role, row.driver_rank, row.user?.current_rank ?? 0)) continue;
    counts.set(row.drive_id, (counts.get(row.drive_id) ?? 0) + 1);
  }
  return counts;
}

async function reportCountsByDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driveIds: string[],
): Promise<Map<string, number>> {
  if (driveIds.length === 0) return new Map();
  const { data } = await supabase
    .from("trip_reports")
    .select("drive_id")
    .eq("is_approved", true)
    .in("drive_id", driveIds);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (!row.drive_id) continue;
    counts.set(row.drive_id, (counts.get(row.drive_id) ?? 0) + 1);
  }
  return counts;
}

/** `null` userRank means signed out — treated as below every rank requirement. */
function UpcomingCard({
  drive,
  userRank,
  registeredDrivers,
}: {
  drive: UpcomingDrive;
  userRank: number | null;
  registeredDrivers: number;
}) {
  // A Member (rank 0) isn't floor-gated by target_rank like a ranked member
  // — they're eligible display-wise for All Levels or a Newbie-only drive
  // (the full "no other active Newbie registration" rule only matters at
  // actual registration time, not for this list-card preview).
  const isLocked =
    userRank === null ||
    (userRank === 0
      ? !(drive.is_all_levels || (drive.allowed_ranks.length === 1 && drive.allowed_ranks[0] === "1"))
      : userRank < drive.target_rank);
  const requiredRank = CLUB_CONFIG.ranks.find((r) => r.level === drive.target_rank);

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-charcoal">{drive.title}</h2>
        <RankBadge rank={rankNameFromLevel(drive.target_rank)} size="xs" className="shrink-0" />
      </div>
      <div className="flex flex-col gap-2 text-sm text-charcoal-light/90">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 shrink-0 text-charcoal-light/60" />
          {formatDate(drive.drive_date)}
          {drive.drive_start_time && (
            <>
              <Clock className="ml-1 h-3.5 w-3.5 shrink-0 text-charcoal-light/60" />
              {formatTime(drive.drive_start_time)}
            </>
          )}
        </span>
        {drive.meeting_point_name && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0 text-charcoal-light/60" />
            {drive.meeting_point_name}
          </span>
        )}
        <span className="text-charcoal-light/70">
          {formatConvoyStatus(registeredDrivers, drive.max_drivers)}
        </span>
      </div>
      <span
        className={`flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isLocked ? "bg-sand-light text-charcoal-light/80" : "bg-forest/10 text-forest"
        }`}
      >
        {isLocked ? (
          <>
            <Lock className="h-3.5 w-3.5" />
            {userRank === null
              ? "Sign in to check eligibility"
              : `Locked: Required Rank ${requiredRank?.title ?? drive.target_rank}`}
          </>
        ) : (
          "Eligible — tap to register"
        )}
      </span>
    </>
  );

  if (isLocked) {
    return (
      <div
        aria-disabled="true"
        className="flex cursor-not-allowed flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 opacity-60 grayscale-[35%]"
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/drives/${drive.id}`}
      className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      {body}
    </Link>
  );
}

function CompletedCard({
  drive,
  registeredDrivers,
  hasReports,
}: {
  drive: CompletedDrive;
  registeredDrivers: number;
  hasReports: boolean;
}) {
  return (
    <Link
      href={`/drives/${drive.id}${hasReports ? "?tab=reports" : ""}`}
      className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-charcoal">{drive.title}</h2>
        <RankBadge rank={rankNameFromLevel(drive.target_rank)} size="xs" className="shrink-0" />
      </div>
      <div className="flex flex-col gap-2 text-sm text-charcoal-light/90">
        {drive.lead_marshal && (
          <span className="flex items-center gap-1.5">
            <UserRound className="h-4 w-4 shrink-0 text-charcoal-light/60" />
            Led by {drive.lead_marshal.full_name ?? drive.lead_marshal.username}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4 shrink-0 text-charcoal-light/60" />
          {drive.location}
        </span>
        <span className="text-charcoal-light/70">
          {formatConvoyStatus(registeredDrivers, drive.max_drivers)}
        </span>
      </div>
      <span className="text-xs font-medium text-forest">
        {hasReports ? "View Trip Reports →" : "No trip reports yet"}
      </span>
    </Link>
  );
}

export default async function DrivesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = DRIVES_TABS.some((t) => t.key === tab) ? tab! : "upcoming";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRank: number | null = null;
  let isMarshal = false;
  let isSuperUser = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("current_rank, is_marshal, is_admin")
      .eq("id", user.id)
      .single();
    userRank = profile?.current_rank ?? null;
    isMarshal = profile?.is_marshal ?? false;
    isSuperUser = profile?.is_admin ?? false;
  }

  // Always run (cheap, count-only) so tab labels are correct before ever
  // switching tabs.
  const [{ count: upcomingCount }, { count: archiveCount }] = await Promise.all([
    supabase
      .from("drives")
      .select("id", { count: "exact", head: true })
      .eq("status", "Scheduled"),
    supabase
      .from("drives")
      .select("id", { count: "exact", head: true })
      .in("status", ["Completed", "Cancelled"])
      .neq("drive_date", UNKNOWN_DATE_SENTINEL),
  ]);

  let error: string | null = null;
  let upcomingDrives: UpcomingDrive[] = [];
  let upcomingCounts = new Map<string, number>();
  let completedDrives: CompletedDrive[] = [];
  let completedDriverCounts = new Map<string, number>();
  let completedReportCounts = new Map<string, number>();
  let archiveDrives: ArchiveDrive[] = [];
  let unknownDateCount = 0;

  if (activeTab === "upcoming") {
    const { data, error: fetchError } = await supabase
      .from("drives")
      .select(
        "id, drive_id_code, title, drive_date, drive_start_time, location, meeting_point_name, target_rank, allowed_ranks, is_all_levels, max_drivers",
      )
      .eq("status", "Scheduled")
      .order("drive_date", { ascending: true })
      .overrideTypes<UpcomingDrive[], { merge: false }>();
    if (fetchError) error = fetchError.message;
    upcomingDrives = data ?? [];
    upcomingCounts = await driverCountsByDrive(
      supabase,
      upcomingDrives.map((d) => d.id),
    );
  } else if (activeTab === "completed") {
    const { data, error: fetchError } = await supabase
      .from("drives")
      .select(
        "id, drive_id_code, title, drive_date, location, target_rank, max_drivers, lead_marshal:profiles(username, full_name)",
      )
      .eq("status", "Completed")
      .neq("drive_date", UNKNOWN_DATE_SENTINEL)
      .order("drive_date", { ascending: false })
      .limit(5)
      .overrideTypes<CompletedDrive[], { merge: false }>();
    if (fetchError) error = fetchError.message;
    completedDrives = data ?? [];
    const ids = completedDrives.map((d) => d.id);
    [completedDriverCounts, completedReportCounts] = await Promise.all([
      driverCountsByDrive(supabase, ids),
      reportCountsByDrive(supabase, ids),
    ]);
  } else {
    const [{ data, error: fetchError }, { count: unknownCount }] = await Promise.all([
      supabase
        .from("drives")
        .select("id, drive_id_code, title, location, drive_date, target_rank, status")
        .in("status", ["Completed", "Cancelled"])
        .neq("drive_date", UNKNOWN_DATE_SENTINEL)
        .order("drive_date", { ascending: false })
        .overrideTypes<ArchiveDrive[], { merge: false }>(),
      supabase
        .from("drives")
        .select("id", { count: "exact", head: true })
        .in("status", ["Completed", "Cancelled"])
        .eq("drive_date", UNKNOWN_DATE_SENTINEL),
    ]);
    if (fetchError) error = fetchError.message;
    archiveDrives = data ?? [];
    unknownDateCount = unknownCount ?? 0;
  }

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

      <Tabs
        tabs={[
          { key: "upcoming", label: `Upcoming Runs (${upcomingCount ?? 0})` },
          { key: "completed", label: "Completed Last 5" },
          { key: "archive", label: `Completed Archive (${archiveCount ?? 0})` },
        ]}
        defaultKey="upcoming"
      />

      {error ? (
        <ErrorState message="Couldn't load drives right now. Please try again shortly." />
      ) : activeTab === "upcoming" ? (
        upcomingDrives.length === 0 ? (
          <EmptyState
            icon={Route}
            title="No upcoming drives"
            message="Official drives will show up here once a marshal schedules one."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {upcomingDrives.map((drive) => (
              <SwipeToDeleteRow
                key={drive.id}
                driveId={drive.id}
                driveTitle={drive.title}
                enabled={isSuperUser}
              >
                <UpcomingCard
                  drive={drive}
                  userRank={userRank}
                  registeredDrivers={upcomingCounts.get(drive.id) ?? 0}
                />
              </SwipeToDeleteRow>
            ))}
          </div>
        )
      ) : activeTab === "completed" ? (
        completedDrives.length === 0 ? (
          <EmptyState
            icon={Route}
            title="No completed drives yet"
            message="Completed drives will show up here once one wraps up."
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {completedDrives.map((drive) => (
              <SwipeToDeleteRow
                key={drive.id}
                driveId={drive.id}
                driveTitle={drive.title}
                enabled={isSuperUser}
              >
                <CompletedCard
                  drive={drive}
                  registeredDrivers={completedDriverCounts.get(drive.id) ?? 0}
                  hasReports={(completedReportCounts.get(drive.id) ?? 0) > 0}
                />
              </SwipeToDeleteRow>
            ))}
          </div>
        )
      ) : archiveDrives.length === 0 && unknownDateCount === 0 ? (
        <EmptyState
          icon={Route}
          title="No archived drives"
          message="Completed and cancelled drives will show up here."
        />
      ) : (
        <ArchiveDriveList drives={archiveDrives} unknownDateCount={unknownDateCount} />
      )}
    </div>
  );
}
