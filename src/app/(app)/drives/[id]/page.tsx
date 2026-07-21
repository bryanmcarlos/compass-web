import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, ShieldAlert, Settings, Megaphone, CheckSquare, PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { RegisterDriveForm } from "@/components/club/RegisterDriveForm";
import { UnregisterButton } from "@/components/club/UnregisterButton";
import { CopyRosterButton } from "@/components/club/CopyRosterButton";
import { Tabs } from "@/components/club/Tabs";
import { DriveHero } from "./DriveHero";
import { RouteLogisticsTab } from "./tabs/RouteLogisticsTab";
import { ConvoyRosterTab, type Registration } from "./tabs/ConvoyRosterTab";
import { TripReportsTab } from "./tabs/TripReportsTab";
import type { TripReportCardData } from "@/components/club/TripReportCard";
import type { PendingReport } from "@/components/club/PendingReportsReview";
import { CLUB_CONFIG } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { getAvailableRoles, type RegistrationRole } from "@/lib/driveRoles";
import { getAppSettings } from "@/lib/appSettings";
import type { DriveStatus } from "@/components/club/DriveBadges";

type DriveDetail = {
  id: string;
  drive_id_code: string;
  title: string;
  status: DriveStatus;
  drive_date: string;
  location: string;
  meeting_point_name: string | null;
  coordinates: string | null;
  exit_location: string | null;
  nearest_petrol_station: string | null;
  map_url: string | null;
  meeting_time: string | null;
  drive_start_time: string | null;
  drive_end_time: string | null;
  radio_frequency: string | null;
  target_rank: number;
  max_drivers: number;
  equipment_requirements: string[] | null;
  banner_url: string | null;
  has_camp: boolean;
  camp_date: string | null;
  camp_time: string | null;
  camp_location: string | null;
  camp_coordinates: string | null;
  camp_schedule_type: string | null;
  lead_marshal: { username: string; full_name: string | null; current_rank: number } | null;
  /** Freeform historical notes carried over from this drive's old
   * forum/WhatsApp brief — nullable like every other optional column here,
   * matching Supabase's actual `null` (not `undefined`) for an unset
   * column. */
  drive_notes: string | null;
};

function rankTitleFor(rank: number | undefined) {
  return CLUB_CONFIG.ranks.find((r) => r.level === rank)?.title ?? "Member";
}

/** Skips registrations with no linked profile — never emits a blank bullet
 * for an orphaned row, and the caller separately skips the whole section
 * header when a role group is empty. */
function convoyRosterLines(registrations: Registration[]) {
  return registrations
    .filter((r) => r.user)
    .map((r) => `• ${r.user!.full_name ?? r.user!.username} (${rankTitleFor(r.user!.current_rank)})`);
}

const DETAIL_TABS = [
  { key: "route", label: "Route & Logistics" },
  { key: "roster", label: "Convoy Roster" },
  { key: "reports", label: "Trip Reports" },
];

export default async function DriveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reportSubmitted?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { reportSubmitted, tab } = await searchParams;
  const activeTab = DETAIL_TABS.some((t) => t.key === tab) ? tab : "route";
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("drives")
    .select(
      `id, drive_id_code, title, status, drive_date, location,
       meeting_point_name, coordinates, exit_location, nearest_petrol_station, map_url,
       meeting_time, drive_start_time, drive_end_time,
       radio_frequency, target_rank, max_drivers, equipment_requirements, banner_url,
       has_camp, camp_date, camp_time, camp_location, camp_coordinates, camp_schedule_type,
       drive_notes,
       lead_marshal:profiles(username, full_name, current_rank)`,
    )
    .eq("id", id)
    .single()
    .overrideTypes<DriveDetail, { merge: false }>();

  if (error || !data) {
    notFound();
  }
  const drive = data;

  const { defaultDriveBannerUrl } = await getAppSettings();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRank: number | null = null;
  let userIsMit = false;
  let isMarshal = false;
  let isAdmin = false;
  // A Super User is a narrower, elevated tier above a standard Marshal —
  // either an explicit admin flag, or a future rank above the current
  // ceiling of 5 (none exist yet, so that half is forward-compatible dead
  // logic until a higher rank tier is introduced).
  let isSuperUser = false;
  let myRegistration: { role: RegistrationRole } | null = null;
  // Any report by this user for this drive, regardless of approval status
  // — a still-pending report already counts as "you've submitted one" for
  // the purposes of swapping Share -> Edit, same as it already blocks a
  // second submission in submitTripReport.
  let myExistingReportId: string | null = null;
  if (user) {
    const [{ data: profile }, { data: existing }, { data: existingReport }] = await Promise.all([
      supabase
        .from("profiles")
        .select("current_rank, is_marshal, is_mit, is_admin")
        .eq("id", user.id)
        .single(),
      supabase
        .from("drive_registrations")
        .select("role")
        .eq("drive_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("trip_reports")
        .select("id")
        .eq("drive_id", id)
        .eq("author_id", user.id)
        .maybeSingle(),
    ]);
    userRank = profile?.current_rank ?? null;
    userIsMit = profile?.is_mit ?? false;
    isMarshal = profile?.is_marshal ?? false;
    isAdmin = profile?.is_admin ?? false;
    isSuperUser = isAdmin || (profile?.current_rank ?? 0) > 5;
    myRegistration = existing ?? null;
    myExistingReportId = existingReport?.id ?? null;
  }

  // Rank alone was never the authorization gate anywhere else in this app —
  // is_marshal / is_admin are the real flags (an MIT member or a rank-5
  // profile with is_marshal somehow unset are both handled specially
  // elsewhere for exactly this reason), so "Marshal or Admin" here means
  // those flags, not current_rank === 5.
  const canReviewReports = isMarshal || isAdmin;

  const requiredRank = CLUB_CONFIG.ranks.find((r) => r.level === drive.target_rank);
  const userRankTitle = CLUB_CONFIG.ranks.find((r) => r.level === userRank)?.title;

  const { data: registrationsData } = await supabase
    .from("drive_registrations")
    .select(
      "id, role, joining_camp, user:profiles(id, username, full_name, avatar_url, current_rank, is_mit, mobile_number, car_details)",
    )
    .eq("drive_id", id)
    .order("registered_at", { ascending: true })
    .overrideTypes<Registration[], { merge: false }>();

  const allRegistrants = registrationsData ?? [];

  // Roster grouping is strictly by the registered role, not the registrant's
  // permanent rank — an Advanced+MIT member registered as 'Support' belongs
  // in Supports, even though they might also be eligible for 'Lead'.
  const leads = allRegistrants.filter((r) => r.role === "Lead");
  const supports = allRegistrants.filter((r) => r.role === "Support");
  const drivers = allRegistrants.filter((r) => r.role === "Driver");

  // Only approved reports — same rule as the public feed. An unapproved
  // report about this drive isn't hidden from the world, it's just not
  // shown here yet either; its author can already see it from their own
  // profile/the moderation queue.
  const { data: tripReportsData } = await supabase
    .from("trip_reports")
    .select(
      `id, report_text, photos, created_at, is_approved,
       author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url, current_rank)`,
    )
    .eq("drive_id", id)
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .overrideTypes<TripReportCardData[], { merge: false }>();

  const tripReports = tripReportsData ?? [];

  // Only fetched at all when the viewer can actually act on it — a plain
  // member has no use for (and shouldn't need a round-trip revealing) the
  // moderation queue for this drive.
  let pendingReports: PendingReport[] = [];
  if (canReviewReports) {
    const { data: pendingData } = await supabase
      .from("trip_reports")
      .select(
        `id, report_text,
         author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url)`,
      )
      .eq("drive_id", id)
      .eq("is_approved", false)
      .order("created_at", { ascending: false })
      .overrideTypes<PendingReport[], { merge: false }>();
    pendingReports = pendingData ?? [];
  }

  const hasSupervisingMarshal = supports.some((r) => r.user?.current_rank === 5);

  const slotCount = Math.max(drive.max_drivers, drivers.length);

  // Only meaningful once userRank is known to be >= drive.target_rank — the
  // "signed out" / "under-ranked" branches below are handled separately and
  // never reach this. -1 is a safe placeholder that always yields [].
  const availableRoles = getAvailableRoles({
    currentRank: userRank ?? -1,
    isMit: userIsMit,
    targetRank: drive.target_rank,
    hasSupervisingMarshal,
  });

  // Empty role groups are omitted entirely (no dangling "SUPPORTS" header
  // with nothing under it), and only actual registrants appear — the open
  // slots shown in the Convoy Roster UI never make it into this text.
  const convoyRosterText = [
    "🏜️ COMPASS CLUB CONVOY ROSTER 🏜️",
    "",
    `🧭 ${drive.title}`,
    `📅 ${formatDate(drive.drive_date)}`,
    `🎖️ Lead Marshal: ${
      drive.lead_marshal
        ? (drive.lead_marshal.full_name ?? drive.lead_marshal.username)
        : "TBD"
    }`,
    ...(leads.length > 0 ? ["", "🛡️ LEAD", ...convoyRosterLines(leads)] : []),
    ...(supports.length > 0
      ? ["", "🔧 SUPPORTS", ...convoyRosterLines(supports)]
      : []),
    ...(drivers.length > 0
      ? ["", "🚙 DRIVERS", ...convoyRosterLines(drivers)]
      : []),
  ].join("\n");

  const broadcastMessage = `Hello COMPASS team, here is the official convoy list for our upcoming drive:\n\n${convoyRosterText}`;
  const broadcastLink = `https://wa.me/?text=${encodeURIComponent(broadcastMessage)}`;

  // Computed once, used in both the empty-state and has-reports layouts
  // inside TripReportsTab, so the three-way Share / Edit / not-registered
  // logic can't drift out of sync between them.
  const reportCta = !myRegistration ? (
    <p className="text-xs text-charcoal-light/60">
      Only registered participants can file a report for this drive.
    </p>
  ) : myExistingReportId ? (
    <Link
      href={`/trip-reports/${myExistingReportId}/edit`}
      className="flex w-fit items-center gap-2 rounded-lg border border-primary/40 bg-off-white px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
    >
      <PenLine className="h-4 w-4" />
      Edit Your Trip Report
    </Link>
  ) : (
    <Link
      href={`/trip-reports/new?driveId=${drive.id}`}
      className="flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90"
    >
      <PenLine className="h-4 w-4" />
      Share a Trip Report
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/drives"
        className="flex items-center gap-1.5 text-sm font-medium text-charcoal-light/80 hover:text-forest"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Drives
      </Link>

      {reportSubmitted === "pending" && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-forest/30 bg-forest/10 px-4 py-3 text-sm font-medium text-forest-dark"
        >
          <CheckSquare className="h-4 w-4 shrink-0" />
          Trip report submitted successfully and is pending Marshal review!
        </div>
      )}

      <DriveHero
        driveIdCode={drive.drive_id_code}
        title={drive.title}
        status={drive.status}
        targetRank={drive.target_rank}
        bannerUrl={drive.banner_url}
        defaultBannerUrl={defaultDriveBannerUrl}
        driveDate={drive.drive_date}
        meetingTime={drive.meeting_time}
        meetingPointName={drive.meeting_point_name}
        mapUrl={drive.map_url}
        leadMarshal={drive.lead_marshal}
        registeredDrivers={drivers.length}
        maxDrivers={drive.max_drivers}
      />

      <Tabs tabs={DETAIL_TABS} defaultKey="route" />

      {activeTab === "route" && <RouteLogisticsTab drive={drive} />}

      {activeTab === "roster" && (
        <ConvoyRosterTab
          leads={leads}
          supports={supports}
          drivers={drivers}
          slotCount={slotCount}
          isSuperUser={isSuperUser}
          driveId={drive.id}
          driveTitle={drive.title}
          driveDate={drive.drive_date}
          targetRank={drive.target_rank}
          maxDrivers={drive.max_drivers}
          hasSupervisingMarshal={hasSupervisingMarshal}
        />
      )}

      {activeTab === "reports" && (
        <TripReportsTab
          tripReports={tripReports}
          pendingReports={pendingReports}
          canReviewReports={canReviewReports}
          isAdmin={isAdmin}
          myRegistration={myRegistration}
          myExistingReportId={myExistingReportId}
          reportCta={reportCta}
        />
      )}

      {drive.status !== "Scheduled" ? (
        <section className="rounded-2xl border border-sand bg-sand-light px-5 py-4 text-center text-sm text-charcoal-light/80">
          Registration is closed — this drive is marked {drive.status}.
        </section>
      ) : myRegistration ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-forest/30 bg-forest/10 px-5 py-5 text-center">
          <span className="flex items-center gap-2 text-sm font-medium text-forest-dark">
            <CheckSquare className="h-4 w-4 shrink-0" />
            You&apos;re registered for this drive as {myRegistration.role}.
          </span>
          <UnregisterButton driveId={drive.id} />
        </section>
      ) : userRank === null ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-sand bg-off-white px-5 py-6 text-center shadow-sm">
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sand-dark/40 px-4 py-2.5 text-sm font-semibold text-charcoal-light/60"
          >
            <Lock className="h-4 w-4" />
            Register for Drive
          </button>
          <p className="text-sm text-charcoal-light/80">
            <Link href="/login" className="font-semibold text-forest hover:underline">
              Sign in
            </Link>{" "}
            to register for this drive.
          </p>
        </section>
      ) : userRank < drive.target_rank ? (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-sand bg-off-white px-5 py-6 text-center shadow-sm">
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sand-dark/40 px-4 py-2.5 text-sm font-semibold text-charcoal-light/60"
          >
            <Lock className="h-4 w-4" />
            Register for Drive
          </button>
          <p className="max-w-sm text-sm text-charcoal-light/80">
            Locked: Required Rank {requiredRank?.title ?? drive.target_rank}. Your current rank
            is {userRankTitle ?? userRank}.
          </p>
        </section>
      ) : availableRoles.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-sand bg-off-white px-5 py-6 text-center shadow-sm">
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sand-dark/40 px-4 py-2.5 text-sm font-semibold text-charcoal-light/60"
          >
            <Lock className="h-4 w-4" />
            Register for Drive
          </button>
          <p className="max-w-sm text-sm text-charcoal-light/80">
            Your rank ({userRankTitle ?? userRank}) doesn&apos;t have an
            available role on this drive.
          </p>
        </section>
      ) : (
        <RegisterDriveForm
          driveId={drive.id}
          availableRoles={availableRoles}
          hasCamp={drive.has_camp}
        />
      )}

      {isMarshal && (
        <section className="flex flex-col gap-4 rounded-2xl border border-forest/30 bg-forest/5 p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <ShieldAlert className="h-4 w-4 text-forest" />
            Marshal Logistics Control Panel
          </h2>

          <div className="flex flex-col gap-2 border-b border-forest/20 pb-4">
            <p className="text-sm text-charcoal-light/80">
              Copy a clean, emoji-formatted convoy roster to paste anywhere,
              or broadcast it straight to WhatsApp with a ready-made
              announcement.
            </p>
            <div className="flex flex-wrap gap-3">
              <CopyRosterButton text={convoyRosterText} />
              <a
                href={broadcastLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-fit items-center gap-2 rounded-lg border border-forest/40 bg-off-white px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest/10"
              >
                <Megaphone className="h-4 w-4" />
                Broadcast Notice
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/drives/${drive.id}/edit`}
              className="flex w-fit items-center gap-2 rounded-lg border border-forest/40 bg-off-white px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest/10"
            >
              <Settings className="h-4 w-4" />
              Edit Drive
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
