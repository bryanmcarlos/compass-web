import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  MapPinned,
  Clock,
  Radio,
  ClipboardList,
  CheckSquare,
  Users,
  ExternalLink,
  UserRound,
  Lock,
  CircleDashed,
  ShieldAlert,
  MessageCircle,
  Settings,
  Tent,
  Megaphone,
  Mountain,
  PenLine,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
  DifficultyBadge,
  StatusIndicator,
  type DriveDifficulty,
  type DriveStatus,
} from "@/components/club/DriveBadges";
import { Avatar } from "@/components/club/Avatar";
import { RankBadge } from "@/components/club/RankBadge";
import { RegisterDriveForm } from "@/components/club/RegisterDriveForm";
import { UnregisterButton } from "@/components/club/UnregisterButton";
import { CopyRosterButton } from "@/components/club/CopyRosterButton";
import { TripReportCard, type TripReportCardData } from "@/components/club/TripReportCard";
import { PendingReportsReview, type PendingReport } from "@/components/club/PendingReportsReview";
import { CLUB_CONFIG } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import { getAvailableRoles, type RegistrationRole } from "@/lib/driveRoles";
import { getAppSettings } from "@/lib/appSettings";

type DriveDetail = {
  id: string;
  drive_id_code: string;
  title: string;
  difficulty: DriveDifficulty;
  status: DriveStatus;
  drive_date: string;
  location: string;
  meeting_point_name: string | null;
  coordinates: string | null;
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
  lead_marshal: { username: string; full_name: string | null } | null;
};

type RegistrationUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  current_rank: number;
  is_mit: boolean;
  mobile_number: string | null;
  car_details: string | null;
};

type Registration = {
  id: string;
  role: RegistrationRole;
  joining_camp: boolean;
  user: RegistrationUser | null;
};

/** "[Nickname/Username] - [Car Details] - [Mobile Number]", omitting any part that's unset. */
function formatAttendeeLine(user: RegistrationUser) {
  return [user.username, user.car_details, user.mobile_number]
    .filter(Boolean)
    .join(" - ");
}

function rankColorVarFor(rank: number | undefined) {
  return CLUB_CONFIG.ranks.find((r) => r.level === rank)?.colorVar;
}

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

/** null when there's no mobile number on file, or it strips down to nothing
 * — a broken wa.me link with an empty number is worse than no button. */
function whatsAppDirectLink(user: RegistrationUser, driveTitle: string): string | null {
  const digits = (user.mobile_number ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!digits) return null;

  const name = user.full_name ?? user.username;
  const message =
    `Hey ${name}! Bryan here from COMPASS. Glad to have you registered for the ` +
    `'${driveTitle}' drive. Just coordinating logistics—are you all set with your ` +
    `deflation gear and radio? 🏜️`;

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function WhatsAppQuickAction({
  user,
  driveTitle,
}: {
  user: RegistrationUser;
  driveTitle: string;
}) {
  const link = whatsAppDirectLink(user, driveTitle);
  if (!link) return null;

  const name = user.full_name ?? user.username;
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={`Message ${name} on WhatsApp`}
      aria-label={`Message ${name} on WhatsApp`}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-forest/70 transition-colors hover:bg-forest/10 hover:text-forest"
    >
      <MessageCircle className="h-3.5 w-3.5" />
    </a>
  );
}

function RegistrationRow({
  registration,
  isSuperUser,
  driveTitle,
}: {
  registration: Registration;
  isSuperUser: boolean;
  driveTitle: string;
}) {
  const { user } = registration;
  const isMitCandidate = user?.current_rank === 4 && user.is_mit;
  return (
    <li className="flex items-center gap-3 rounded-lg border border-sand px-3 py-2">
      <Avatar
        name={user?.username ?? "Member"}
        avatarUrl={user?.avatar_url ?? null}
        rankColorVar={rankColorVarFor(user?.current_rank)}
        className="h-8 w-8 text-xs"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal">
        {user ? formatAttendeeLine(user) : "Member"}
      </span>
      {isSuperUser && user && (
        <WhatsAppQuickAction user={user} driveTitle={driveTitle} />
      )}
      {isMitCandidate && (
        <span className="shrink-0 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-forest uppercase">
          MIT
        </span>
      )}
      {registration.joining_camp && (
        <span
          title="Joining for camping"
          className="flex shrink-0 items-center gap-1 rounded-full bg-sand-light px-2 py-0.5 text-[10px] font-semibold text-charcoal-light/80"
        >
          <Tent className="h-3 w-3" />
          Camping
        </span>
      )}
      {user && (
        <RankBadge
          rank={user.current_rank}
          className="ml-auto shrink-0 text-[11px]"
          iconClassName="h-3 w-3"
        />
      )}
    </li>
  );
}

function SlotRow({
  index,
  registration,
  isSuperUser,
  driveTitle,
}: {
  index: number;
  registration: Registration | undefined;
  isSuperUser: boolean;
  driveTitle: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-sand px-3 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand-light text-xs font-semibold text-charcoal-light/70">
        {index + 1}
      </span>
      {registration?.user ? (
        <>
          <Avatar
            name={registration.user.username}
            avatarUrl={registration.user.avatar_url}
            rankColorVar={rankColorVarFor(registration.user.current_rank)}
            className="h-8 w-8 text-xs"
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal">
            {formatAttendeeLine(registration.user)}
          </span>
          {isSuperUser && (
            <WhatsAppQuickAction user={registration.user} driveTitle={driveTitle} />
          )}
          {registration.joining_camp && (
            <span
              title="Joining for camping"
              className="flex shrink-0 items-center gap-1 rounded-full bg-sand-light px-2 py-0.5 text-[10px] font-semibold text-charcoal-light/80"
            >
              <Tent className="h-3 w-3" />
              Camping
            </span>
          )}
        </>
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-charcoal-light/50 italic">
          <CircleDashed className="h-4 w-4" />
          Open slot
        </span>
      )}
    </li>
  );
}

export default async function DriveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reportSubmitted?: string }>;
}) {
  const { id } = await params;
  const { reportSubmitted } = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("drives")
    .select(
      `id, drive_id_code, title, difficulty, status, drive_date, location,
       meeting_point_name, coordinates, map_url, meeting_time, drive_start_time, drive_end_time,
       radio_frequency, target_rank, max_drivers, equipment_requirements, banner_url,
       has_camp, camp_date, camp_time, camp_location, camp_coordinates, camp_schedule_type,
       lead_marshal:profiles(username, full_name)`,
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
  // slots shown in the Signup Sheet UI never make it into this text.
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
  // below, so the three-way Share / Edit / not-registered logic can't drift
  // out of sync between them.
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

      <section className="overflow-hidden rounded-2xl border border-sand bg-off-white shadow-sm">
        <div className="relative h-48 w-full sm:h-64">
          {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage / local default, no fixed remote domain to allowlist */}
          <img
            src={drive.banner_url || defaultDriveBannerUrl || "/defaults/desert-banner.svg"}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-charcoal/90 via-charcoal/15 to-transparent"
          />

          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            <span className="rounded-full bg-charcoal/50 px-2.5 py-1 font-mono text-xs font-medium tracking-wide text-off-white uppercase backdrop-blur-sm">
              {drive.drive_id_code}
            </span>
            <DifficultyBadge difficulty={drive.difficulty} />
          </div>

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-4 sm:p-5">
            <h1 className="text-xl font-bold text-off-white drop-shadow-sm sm:text-2xl">
              {drive.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <StatusIndicator
                status={drive.status}
                className="rounded-full bg-charcoal/40 px-2 py-0.5 text-xs font-medium backdrop-blur-sm"
              />
              <span className="rounded-full bg-charcoal/40 px-2.5 py-1 text-xs font-semibold text-off-white backdrop-blur-sm">
                Required Rank: {requiredRank?.title ?? drive.target_rank}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-5 text-sm text-charcoal-light/90 sm:p-6">
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
              Led by {drive.lead_marshal.full_name ?? drive.lead_marshal.username}
            </span>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <MapPinned className="h-4 w-4 text-forest" />
            Meeting Point
          </h2>
          {drive.meeting_point_name && (
            <p className="text-sm text-charcoal">{drive.meeting_point_name}</p>
          )}
          {drive.coordinates && (
            <p className="font-mono text-xs text-charcoal-light/70">{drive.coordinates}</p>
          )}
          {drive.map_url && (
            <a
              href={drive.map_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-forest hover:underline"
            >
              Open in Maps
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <Clock className="h-4 w-4 text-forest" />
            Timing
          </h2>
          {(() => {
            // Each row is decoupled and computed independently — a null,
            // empty, or malformed value in one field never affects whether
            // the others render, and formatTime() itself never throws.
            const rows: [string, string | null][] = [
              ["Meeting Time", formatTime(drive.meeting_time)],
              ["Drive Start", formatTime(drive.drive_start_time)],
              ["Expected End", formatTime(drive.drive_end_time)],
            ];
            const visibleRows = rows.filter(
              (row): row is [string, string] => row[1] !== null,
            );

            if (visibleRows.length === 0) {
              return (
                <p className="text-sm text-charcoal-light/70 italic">
                  Timing details to be confirmed by Marshal.
                </p>
              );
            }

            return (
              <dl className="flex flex-col gap-1.5 text-sm">
                {visibleRows.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-charcoal-light/70">{label}</dt>
                    <dd className="font-medium text-charcoal">{value}</dd>
                  </div>
                ))}
              </dl>
            );
          })()}
          {drive.radio_frequency && (
            <p className="flex items-center gap-1.5 border-t border-sand pt-2 text-sm text-charcoal-light/90">
              <Radio className="h-4 w-4 shrink-0 text-charcoal-light/60" />
              Channel {drive.radio_frequency}
            </p>
          )}
        </div>

        {drive.has_camp && (
          <div className="flex flex-col gap-3 rounded-2xl border border-forest/30 bg-forest/5 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
              <Tent className="h-4 w-4 text-forest" />
              ⛺ Camping Details
            </h2>
            {drive.camp_schedule_type && (
              <span className="inline-flex w-fit items-center rounded-full bg-forest/10 px-2.5 py-1 text-xs font-semibold text-forest">
                {drive.camp_schedule_type}
              </span>
            )}
            <dl className="flex flex-col gap-1.5 text-sm">
              {drive.camp_date && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-light/70">Date</dt>
                  <dd className="font-medium text-charcoal">{formatDate(drive.camp_date)}</dd>
                </div>
              )}
              {drive.camp_time && (
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-light/70">Time</dt>
                  <dd className="font-medium text-charcoal">{formatTime(drive.camp_time)}</dd>
                </div>
              )}
            </dl>
            {drive.camp_location && (
              <p className="text-sm text-charcoal">{drive.camp_location}</p>
            )}
            {drive.camp_coordinates && (
              <>
                <p className="font-mono text-xs text-charcoal-light/70">
                  {drive.camp_coordinates}
                </p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(drive.camp_coordinates)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-fit items-center gap-1.5 text-sm font-medium text-forest hover:underline"
                >
                  Open in Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            )}
          </div>
        )}
      </section>

      {drive.equipment_requirements && drive.equipment_requirements.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
            <ClipboardList className="h-4 w-4 text-forest" />
            Equipment Requirements
          </h2>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {drive.equipment_requirements.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-charcoal-light/90">
                <CheckSquare className="h-4 w-4 shrink-0 text-forest" />
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Users className="h-4 w-4 text-forest" />
          Signup Sheet
        </h2>

        {leads.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
              Lead
            </h3>
            <ul className="flex flex-col gap-2">
              {leads.map((r) => (
                <RegistrationRow
                  key={r.id}
                  registration={r}
                  isSuperUser={isSuperUser}
                  driveTitle={drive.title}
                />
              ))}
            </ul>
          </div>
        )}

        {supports.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
              Supports
            </h3>
            <ul className="flex flex-col gap-2">
              {supports.map((r) => (
                <RegistrationRow
                  key={r.id}
                  registration={r}
                  isSuperUser={isSuperUser}
                  driveTitle={drive.title}
                />
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
            Drivers ({drivers.length}/{drive.max_drivers})
          </h3>
          <ul className="flex flex-col gap-2">
            {Array.from({ length: slotCount }).map((_, i) => (
              <SlotRow
                key={i}
                index={i}
                registration={drivers[i]}
                isSuperUser={isSuperUser}
                driveTitle={drive.title}
              />
            ))}
          </ul>
        </div>
      </section>

      {canReviewReports && <PendingReportsReview reports={pendingReports} />}

      <section className="flex flex-col gap-4 rounded-2xl border border-sand bg-gradient-to-br from-off-white to-sand-light/30 p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Mountain className="h-4 w-4 text-forest" />
          Trip Reports for this Drive
        </h2>

        {tripReports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand px-5 py-8 text-center">
            <p className="max-w-sm text-sm text-charcoal-light/80">
              {myRegistration && !myExistingReportId
                ? "No trip reports filed for this adventure yet. Be the first to share yours!"
                : "No trip reports filed for this adventure yet."}
            </p>
            {reportCta}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tripReports.map((report) => (
                <TripReportCard
                  key={report.id}
                  report={report}
                  linkToDetail
                  showDriveContext={false}
                  canDelete={isAdmin}
                />
              ))}
            </div>
            {myRegistration && <div className="self-center">{reportCta}</div>}
          </>
        )}
      </section>

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
