import { Users, CircleDashed, Tent, MessageCircle, UserPlus } from "lucide-react";
import { Avatar } from "@/components/club/Avatar";
import { HoldToRevealRankBadge } from "@/components/club/HoldToRevealRankBadge";
import { AssignDriverSlotModal } from "@/components/club/AssignDriverSlotModal";
import { CLUB_CONFIG, rankNameFromLevel, type RankName } from "@/lib/constants";
import type { RegistrationRole } from "@/lib/driveRoles";

export type RegistrationUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  current_rank: number;
  is_mit: boolean;
  mobile_number: string | null;
  car_details: string | null;
};

export type Registration = {
  id: string;
  role: RegistrationRole;
  joining_camp: boolean;
  /** Rank snapshot taken at registration time — what the Driver sub-groups
   * below actually group by, not the member's current (possibly
   * since-promoted) profile rank. Null on every row created before this
   * column existed; RegistrationRow/groupDriversByRank fall back to the
   * member's current rank for those. */
  driver_rank: string | null;
  user: RegistrationUser | null;
};

type SharedModalProps = {
  driveId: string;
  driveTitle: string;
  driveDate: string;
  targetRank: number;
  allowedRanks: number[];
  isAllLevels: boolean;
  hasSupervisingMarshal: boolean;
};

/** "[Nickname/Username] - [Car Details] - [Mobile Number]", omitting any part that's unset. */
function formatAttendeeLine(user: RegistrationUser) {
  return [user.full_name ?? user.username, user.car_details, user.mobile_number]
    .filter(Boolean)
    .join(" - ");
}

function rankColorVarFor(rank: number | undefined) {
  return CLUB_CONFIG.ranks.find((r) => r.level === rank)?.colorVar;
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

/** Handles every filled registration row — Lead, Support, and now Driver
 * too (the old SlotRow-with-a-filled-branch split is gone; SlotRow below is
 * exclusively for open/unfilled slots now that Drivers render grouped by
 * rank instead of as one flat numbered list). */
function RegistrationRow({
  registration,
  isSuperUser,
  modalProps,
}: {
  registration: Registration;
  isSuperUser: boolean;
  modalProps: SharedModalProps;
}) {
  const { user } = registration;
  const isMitCandidate = user?.current_rank === 4 && user.is_mit;

  const rowContent = (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar
        name={user?.full_name ?? user?.username ?? "Member"}
        avatarUrl={user?.avatar_url ?? null}
        rankColorVar={rankColorVarFor(user?.current_rank)}
        className="h-8 w-8 text-xs"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal">
        {user ? formatAttendeeLine(user) : "Member"}
      </span>
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
        <HoldToRevealRankBadge
          historicalRank={registration.driver_rank as RankName | null}
          liveRank={rankNameFromLevel(user.current_rank)}
          className="ml-auto shrink-0 text-[11px]"
          size="xs"
        />
      )}
    </span>
  );

  return (
    <li className="flex items-center gap-3 rounded-lg border border-sand px-3 py-2">
      {isSuperUser && user ? (
        <AssignDriverSlotModal
          mode="edit"
          {...modalProps}
          registrationId={registration.id}
          currentRole={registration.role}
          member={user}
          trigger={rowContent}
        />
      ) : (
        rowContent
      )}
      {isSuperUser && user && <WhatsAppQuickAction user={user} driveTitle={modalProps.driveTitle} />}
    </li>
  );
}

/** Open (unfilled) Driver slots only — filled ones render via
 * RegistrationRow inside their rank group instead. An empty slot has no
 * rank identity yet, so these render in one un-grouped pool below the
 * filled, per-rank-grouped rows. */
function SlotRow({
  index,
  isSuperUser,
  modalProps,
}: {
  index: number;
  isSuperUser: boolean;
  modalProps: SharedModalProps;
}) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-sand px-3 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand-light text-xs font-semibold text-charcoal-light/70">
        {index + 1}
      </span>
      {isSuperUser ? (
        <AssignDriverSlotModal
          mode="add"
          {...modalProps}
          trigger={
            <span className="flex flex-1 items-center gap-1.5 text-sm text-charcoal-light/50 italic transition-colors hover:text-forest hover:not-italic">
              <CircleDashed className="h-4 w-4 shrink-0" />
              Open slot — click to add
            </span>
          }
        />
      ) : (
        <span className="flex items-center gap-1.5 text-sm text-charcoal-light/50 italic">
          <CircleDashed className="h-4 w-4" />
          Open slot
        </span>
      )}
    </li>
  );
}

// Member folds into the Newbie bucket for display — a Member is only ever
// on their one Newbie-only or All Levels drive, and the spec groups them
// under "NEWBIE DRIVERS" rather than a separate bucket, while driver_rank
// itself still stores the real historical snapshot ("Member").
const DRIVER_RANK_GROUPS: { key: RankName; label: string; emoji: string }[] = [
  { key: "Newbie", label: "NEWBIE DRIVERS", emoji: "🟢" },
  { key: "Rookie", label: "ROOKIE DRIVERS", emoji: "🟡" },
  { key: "Intermediate", label: "INTERMEDIATE DRIVERS", emoji: "🟠" },
  { key: "Advanced", label: "ADVANCE DRIVERS", emoji: "🔵" },
  // A Marshal can register as a plain Driver on someone else's drive (not
  // just Lead/Support) — most often on older drives predating driver_rank,
  // where the snapshot is null and this falls back to their current rank.
  { key: "Marshal", label: "MARSHAL DRIVERS", emoji: "🔴" },
];

function groupDriversByRank(drivers: Registration[]): Map<RankName, Registration[]> {
  const groups = new Map<RankName, Registration[]>();
  for (const r of drivers) {
    const raw = r.driver_rank ?? rankNameFromLevel(r.user?.current_rank);
    const key = (raw === "Member" ? "Newbie" : raw) as RankName;
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }
  return groups;
}

export function ConvoyRosterTab({
  leads,
  supports,
  drivers,
  slotCount,
  driverSlotCount,
  isSuperUser,
  driveId,
  driveTitle,
  driveDate,
  targetRank,
  allowedRanks,
  isAllLevels,
  maxDrivers,
  hasSupervisingMarshal,
}: {
  leads: Registration[];
  supports: Registration[];
  drivers: Registration[];
  slotCount: number;
  /** Drivers plus non-Marshal Support registrants — the same figure shown
   * as Convoy Status on DriveHero, so this header doesn't disagree with it.
   * Distinct from `drivers.length`, which stays Driver-role-only since
   * that's still what the rank-grouped sections below actually list. */
  driverSlotCount: number;
  isSuperUser: boolean;
  driveId: string;
  driveTitle: string;
  driveDate: string;
  targetRank: number;
  allowedRanks: number[];
  isAllLevels: boolean;
  maxDrivers: number;
  hasSupervisingMarshal: boolean;
}) {
  const modalProps: SharedModalProps = {
    driveId,
    driveTitle,
    driveDate,
    targetRank,
    allowedRanks,
    isAllLevels,
    hasSupervisingMarshal,
  };

  const driverGroups = groupDriversByRank(drivers);
  const openSlotCount = Math.max(slotCount - drivers.length, 0);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Users className="h-4 w-4 text-forest" />
          Convoy Roster
        </h2>
        {isSuperUser && (
          <AssignDriverSlotModal
            mode="add"
            {...modalProps}
            trigger={
              <span className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-off-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
                <UserPlus className="h-3.5 w-3.5" />
                Add Participant
              </span>
            }
          />
        )}
      </div>

      {leads.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
            👑 Lead ({leads.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {leads.map((r) => (
              <RegistrationRow key={r.id} registration={r} isSuperUser={isSuperUser} modalProps={modalProps} />
            ))}
          </ul>
        </div>
      )}

      {supports.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
            🛡️ Support ({supports.length})
          </h3>
          <ul className="flex flex-col gap-2">
            {supports.map((r) => (
              <RegistrationRow key={r.id} registration={r} isSuperUser={isSuperUser} modalProps={modalProps} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
          Drivers ({driverSlotCount}/{maxDrivers})
        </h3>

        {DRIVER_RANK_GROUPS.map(({ key, label, emoji }) => {
          const group = driverGroups.get(key);
          if (!group || group.length === 0) return null;
          return (
            <div key={key} className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold tracking-wide text-charcoal-light/60 uppercase">
                {emoji} {label} ({group.length})
              </h4>
              <ul className="flex flex-col gap-2">
                {group.map((r) => (
                  <RegistrationRow
                    key={r.id}
                    registration={r}
                    isSuperUser={isSuperUser}
                    modalProps={modalProps}
                  />
                ))}
              </ul>
            </div>
          );
        })}

        {/* Safety net for any rank bucket this drive's data resolves to that
            isn't one of the fixed groups above (e.g. "General", the fallback
            for a driver_rank snapshot with no matching current rank at all)
            — registered drivers must never silently vanish from the roster
            just because their rank doesn't match a known bucket. */}
        {Array.from(driverGroups.entries())
          .filter(([key, group]) => group.length > 0 && !DRIVER_RANK_GROUPS.some((g) => g.key === key))
          .map(([key, group]) => (
            <div key={key} className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold tracking-wide text-charcoal-light/60 uppercase">
                ⚪ {key.toUpperCase()} DRIVERS ({group.length})
              </h4>
              <ul className="flex flex-col gap-2">
                {group.map((r) => (
                  <RegistrationRow
                    key={r.id}
                    registration={r}
                    isSuperUser={isSuperUser}
                    modalProps={modalProps}
                  />
                ))}
              </ul>
            </div>
          ))}

        {openSlotCount > 0 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold tracking-wide text-charcoal-light/60 uppercase">
              Open Slots ({openSlotCount})
            </h4>
            <ul className="flex flex-col gap-2">
              {Array.from({ length: openSlotCount }).map((_, i) => (
                <SlotRow key={`empty-slot-${i}`} index={drivers.length + i} isSuperUser={isSuperUser} modalProps={modalProps} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
