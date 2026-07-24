import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert, Settings, CheckSquare, PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { DriveRegistrationProvider } from "@/components/club/DriveRegistrationContext";
import { RegistrationSection } from "@/components/club/RegistrationSection";
import { CopyRosterButton } from "@/components/club/CopyRosterButton";
import { BroadcastNoticeModal } from "@/components/club/BroadcastNoticeModal";
import { DriveQuickActionButtons } from "@/components/club/DriveQuickActionButtons";
import type { BroadcastTemplateData } from "@/lib/broadcastTemplate";
import { Tabs } from "@/components/club/Tabs";
import { DriveHero } from "./DriveHero";
import { RouteLogisticsTab } from "./tabs/RouteLogisticsTab";
import { ConvoyRosterTab, type Registration } from "./tabs/ConvoyRosterTab";
import { TripReportsTab } from "./tabs/TripReportsTab";
import type { CleanupCandidateReport } from "@/components/club/DriveReportCleanupPanel";
import { dedupeByThread } from "@/lib/tripReportThreadGrouping";
import {
  CLEANUP_DATE_WINDOW_DAYS,
  extractTitleKeywords,
  countKeywordHits,
} from "@/lib/tripReportMatching";
import type { TripReportCardData } from "@/components/club/TripReportCard";
import type { PendingReport } from "@/components/club/PendingReportsReview";
import { CLUB_CONFIG, rankNameFromLevel } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import { getAvailableRoles, countsAsDriverSlot, type RegistrationRole } from "@/lib/driveRoles";
import { checkMemberEligibleForDrive } from "./actions";
import { getAppSettings } from "@/lib/appSettings";
import { SITE_URL } from "@/lib/siteUrl";
import type { DriveStatus } from "@/components/club/DriveBadges";

type DriveDetail = {
  id: string;
  drive_id_code: string;
  title: string;
  status: DriveStatus;
  registration_closed: boolean;
  drive_date: string;
  location: string;
  meeting_point_name: string | null;
  coordinates: string | null;
  exit_location: string | null;
  exit_location_map_url: string | null;
  nearest_petrol_station: string | null;
  nearest_petrol_station_map_url: string | null;
  map_url: string | null;
  meeting_time: string | null;
  drive_start_time: string | null;
  drive_end_time: string | null;
  radio_frequency: string | null;
  target_rank: number;
  allowed_ranks: string[];
  is_all_levels: boolean;
  max_drivers: number;
  equipment_requirements: string[] | null;
  must_skills_covered: string[] | null;
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
      `id, drive_id_code, title, status, registration_closed, drive_date, location,
       meeting_point_name, coordinates, exit_location, exit_location_map_url,
       nearest_petrol_station, nearest_petrol_station_map_url, map_url,
       meeting_time, drive_start_time, drive_end_time,
       radio_frequency, target_rank, allowed_ranks, is_all_levels, max_drivers, equipment_requirements, must_skills_covered, banner_url,
       has_camp, camp_date, camp_time, camp_location, camp_coordinates, camp_schedule_type,
       drive_notes,
       lead_marshal:profiles(username, full_name, current_rank)`,
    )
    .eq("id", id)
    .single()
    .overrideTypes<DriveDetail, { merge: false }>();

  if (error || !data) {
    if (error) console.error("SERVER ERROR [DriveDetailPage select]:", error);
    notFound();
  }
  const drive = data;

  const { defaultDriveBannerUrl, broadcastMessageTemplate } = await getAppSettings();

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
  let myMobileNumber: string | null = null;
  let myCarDetails: string | null = null;
  if (user) {
    const [{ data: profile }, { data: existing }, { data: existingReport }] = await Promise.all([
      supabase
        .from("profiles")
        .select("current_rank, is_marshal, is_mit, is_admin, mobile_number, car_details")
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
    myMobileNumber = profile?.mobile_number ?? null;
    myCarDetails = profile?.car_details ?? null;
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
      "id, role, joining_camp, driver_rank, user:profiles(id, username, full_name, avatar_url, current_rank, is_mit, mobile_number, car_details)",
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

  // The "active driver slot" figure shown on Convoy Status and the roster's
  // Drivers header — Drivers plus non-Marshal Support registrants, since an
  // Advanced member Supporting a drive still occupies a driver-equivalent
  // seat while a Marshal Supporting doesn't. Distinct from `drivers` above,
  // which stays Driver-role-only because that's what the rank-grouped
  // sections actually list.
  const driverSlotCount = allRegistrants.filter((r) =>
    countsAsDriverSlot(r.role, r.driver_rank, r.user?.current_rank ?? 0),
  ).length;

  const { data: driveReactionRows } = await supabase
    .from("drive_reactions")
    .select("user_id")
    .eq("drive_id", id);
  const driveLikeCount = driveReactionRows?.length ?? 0;
  const driveViewerLiked = Boolean(user && driveReactionRows?.some((r) => r.user_id === user.id));

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
    .order("created_at", { ascending: true })
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

  // Admin-only candidate pools for the temporary trip-report linking
  // cleanup tool — never fetched for anyone else, so this costs nothing on
  // every other drive page view. Both queries explicitly include NULL
  // drive_id rows alongside "linked to a different drive" ones: a plain
  // `.neq("drive_id", id)` would silently drop every unlinked report too,
  // since SQL's `NULL <> x` is neither true nor false.
  let cleanupDateCandidates: CleanupCandidateReport[] = [];
  let cleanupKeywordCandidates: CleanupCandidateReport[] = [];
  if (isAdmin) {
    // What the SELECT actually returns — dedupeByThread adds `replyCount`
    // to produce the real CleanupCandidateReport shape the panel renders.
    type RawCandidateRow = Omit<CleanupCandidateReport, "replyCount">;

    const CANDIDATE_FIELDS =
      "id, report_text, created_at, thread_id, " +
      "author:profiles!trip_reports_author_id_fkey(username, full_name), " +
      "currentDrive:drives(id, title)";
    const notThisDrive = `drive_id.is.null,drive_id.neq.${id}`;
    // The root-post refetch inside dedupeByThread doesn't re-apply this
    // filter (it just wants "the thread's whole story," not just the post
    // that happened to match), so a thread whose root is already correctly
    // linked here — only a reply matched the date/keyword filter — needs
    // filtering back out afterward or it'd show up as its own candidate.
    const notAlreadyLinkedHere = (rows: CleanupCandidateReport[]) =>
      rows.filter((r) => r.currentDrive?.id !== id);

    const driveDateMs = new Date(drive.drive_date).getTime();
    const windowFrom = new Date(
      driveDateMs - CLEANUP_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const windowTo = new Date(
      driveDateMs + CLEANUP_DATE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: dateRows } = await supabase
      .from("trip_reports")
      .select(CANDIDATE_FIELDS)
      .or(notThisDrive)
      .gte("created_at", windowFrom)
      .lte("created_at", windowTo)
      .order("created_at", { ascending: false })
      .limit(20)
      .overrideTypes<RawCandidateRow[], { merge: false }>();
    cleanupDateCandidates = notAlreadyLinkedHere(
      await dedupeByThread(supabase, dateRows ?? [], CANDIDATE_FIELDS),
    );

    const titleKeywords = extractTitleKeywords(drive.title).slice(0, 6);
    if (titleKeywords.length > 0) {
      const ilikeFilter = titleKeywords.map((kw) => `report_text.ilike.%${kw}%`).join(",");
      const { data: keywordRows } = await supabase
        .from("trip_reports")
        .select(CANDIDATE_FIELDS)
        .or(notThisDrive)
        .or(ilikeFilter)
        .order("created_at", { ascending: false })
        .limit(30)
        .overrideTypes<RawCandidateRow[], { merge: false }>();

      const scoredKeywordCandidates = (keywordRows ?? [])
        .map((report) => ({ report, hits: countKeywordHits(titleKeywords, report.report_text) }))
        .filter((entry) => entry.hits > 0)
        .sort((a, b) => b.hits - a.hits)
        .slice(0, 10)
        .map((entry) => entry.report);

      cleanupKeywordCandidates = notAlreadyLinkedHere(
        await dedupeByThread(supabase, scoredKeywordCandidates, CANDIDATE_FIELDS),
      );
    }
  }

  const hasSupervisingMarshal = supports.some((r) => r.user?.current_rank === 5);

  const slotCount = Math.max(drive.max_drivers, drivers.length);

  // Only meaningful once userRank is known to be >= drive.target_rank — the
  // "signed out" / "under-ranked" branches below are handled separately and
  // never reach this. -1 is a safe placeholder that always yields [].
  // Member (rank 0) bypasses getAvailableRoles entirely — see
  // checkMemberEligibleForDrive's own doc comment for why this is a policy
  // overlay rather than part of the rank hierarchy that function encodes.
  const availableRoles =
    userRank === 0
      ? (await checkMemberEligibleForDrive(
            supabase,
            user!.id,
            id,
            drive.allowed_ranks,
            drive.is_all_levels,
          ))
        ? (["Driver"] as RegistrationRole[])
        : []
      : getAvailableRoles({
          currentRank: userRank ?? -1,
          isMit: userIsMit,
          targetRank: drive.target_rank,
          allowedRanks: drive.allowed_ranks.map(Number),
          isAllLevels: drive.is_all_levels,
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

  const broadcastData: BroadcastTemplateData = {
    drive_title: drive.title,
    drive_code: drive.drive_id_code,
    drive_date: formatDate(drive.drive_date),
    meeting_time: formatTime(drive.meeting_time) ?? "TBD",
    meeting_point: drive.meeting_point_name ?? "TBD",
    map_url: drive.map_url ?? "TBD",
    target_rank:
      CLUB_CONFIG.ranks.find((r) => r.level === drive.target_rank)?.title ??
      rankNameFromLevel(drive.target_rank),
    lead_marshal: drive.lead_marshal
      ? (drive.lead_marshal.full_name ?? drive.lead_marshal.username)
      : "TBD",
    drive_link: `${SITE_URL}/drives/${drive.id}`,
  };

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

      <DriveRegistrationProvider
        initialDriverCount={driverSlotCount}
        initialRegistration={myRegistration}
        initialStatus={drive.status}
        initialRegistrationClosed={drive.registration_closed}
      >
      <DriveHero
        driveId={drive.id}
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
        registeredDrivers={driverSlotCount}
        maxDrivers={drive.max_drivers}
        likeCount={driveLikeCount}
        viewerLiked={driveViewerLiked}
      />

      <Tabs tabs={DETAIL_TABS} defaultKey="route" />

      {activeTab === "route" && <RouteLogisticsTab drive={drive} />}

      {activeTab === "roster" && (
        <ConvoyRosterTab
          leads={leads}
          supports={supports}
          drivers={drivers}
          slotCount={slotCount}
          driverSlotCount={driverSlotCount}
          isSuperUser={isSuperUser}
          driveId={drive.id}
          driveTitle={drive.title}
          driveDate={drive.drive_date}
          targetRank={drive.target_rank}
          allowedRanks={drive.allowed_ranks.map(Number)}
          isAllLevels={drive.is_all_levels}
          maxDrivers={drive.max_drivers}
          hasSupervisingMarshal={hasSupervisingMarshal}
        />
      )}

      {activeTab === "reports" && (
        <TripReportsTab
          driveId={id}
          tripReports={tripReports}
          pendingReports={pendingReports}
          canReviewReports={canReviewReports}
          isAdmin={isAdmin}
          myRegistration={myRegistration}
          myExistingReportId={myExistingReportId}
          reportCta={reportCta}
          cleanupDateCandidates={cleanupDateCandidates}
          cleanupKeywordCandidates={cleanupKeywordCandidates}
        />
      )}

      <RegistrationSection
        driveId={drive.id}
        targetRank={drive.target_rank}
        requiredRankTitle={requiredRank?.title}
        userRank={userRank}
        userRankTitle={userRankTitle}
        availableRoles={availableRoles}
        hasCamp={drive.has_camp}
        mustSkillsCovered={drive.must_skills_covered ?? []}
        profileComplete={Boolean(myMobileNumber) && Boolean(myCarDetails)}
        initialMobileNumber={myMobileNumber}
        initialCarDetails={myCarDetails}
      />

      {isMarshal && (
        <section className="flex flex-col gap-4 rounded-2xl border border-forest/30 bg-forest/5 p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <ShieldAlert className="h-4 w-4 text-forest" />
            Marshal Logistics Control Panel
          </h2>

          <div className="flex flex-col gap-2 border-b border-forest/20 pb-4">
            <p className="text-sm text-charcoal-light/80">
              Copy a clean, emoji-formatted convoy roster to paste anywhere,
              or broadcast a customizable drive notice to WhatsApp or
              Messenger.
            </p>
            <div className="flex flex-wrap gap-3">
              <CopyRosterButton text={convoyRosterText} />
              <BroadcastNoticeModal template={broadcastMessageTemplate} data={broadcastData} />
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <Link
              href={`/drives/${drive.id}/edit`}
              className="flex w-fit items-center gap-2 rounded-lg border border-forest/40 bg-off-white px-4 py-2.5 text-sm font-semibold text-forest transition-colors hover:bg-forest/10"
            >
              <Settings className="h-4 w-4" />
              Edit Drive
            </Link>
            <DriveQuickActionButtons
              driveId={drive.id}
              isAdmin={isAdmin}
              registrationClosed={drive.registration_closed}
            />
          </div>
        </section>
      )}
      </DriveRegistrationProvider>
    </div>
  );
}
