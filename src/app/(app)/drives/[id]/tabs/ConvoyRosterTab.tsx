import { Users, CircleDashed, Tent, MessageCircle, UserPlus } from "lucide-react";
import { Avatar } from "@/components/club/Avatar";
import { RankBadge } from "@/components/club/RankBadge";
import { AssignDriverSlotModal } from "@/components/club/AssignDriverSlotModal";
import { CLUB_CONFIG, rankNameFromLevel } from "@/lib/constants";
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
  user: RegistrationUser | null;
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

function RegistrationRow({
  registration,
  isSuperUser,
  driveTitle,
  driveId,
  driveDate,
  targetRank,
  hasSupervisingMarshal,
}: {
  registration: Registration;
  isSuperUser: boolean;
  driveTitle: string;
  driveId: string;
  driveDate: string;
  targetRank: number;
  hasSupervisingMarshal: boolean;
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
        <RankBadge
          rank={rankNameFromLevel(user.current_rank)}
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
          driveId={driveId}
          driveTitle={driveTitle}
          driveDate={driveDate}
          targetRank={targetRank}
          hasSupervisingMarshal={hasSupervisingMarshal}
          registrationId={registration.id}
          currentRole={registration.role}
          member={user}
          trigger={rowContent}
        />
      ) : (
        rowContent
      )}
      {isSuperUser && user && <WhatsAppQuickAction user={user} driveTitle={driveTitle} />}
    </li>
  );
}

function SlotRow({
  index,
  registration,
  isSuperUser,
  driveTitle,
  driveId,
  driveDate,
  targetRank,
  hasSupervisingMarshal,
}: {
  index: number;
  registration: Registration | undefined;
  isSuperUser: boolean;
  driveTitle: string;
  driveId: string;
  driveDate: string;
  targetRank: number;
  hasSupervisingMarshal: boolean;
}) {
  const filledContent = registration?.user && (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar
        name={registration.user.full_name ?? registration.user.username}
        avatarUrl={registration.user.avatar_url}
        rankColorVar={rankColorVarFor(registration.user.current_rank)}
        className="h-8 w-8 text-xs"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal">
        {formatAttendeeLine(registration.user)}
      </span>
      {registration.joining_camp && (
        <span
          title="Joining for camping"
          className="flex shrink-0 items-center gap-1 rounded-full bg-sand-light px-2 py-0.5 text-[10px] font-semibold text-charcoal-light/80"
        >
          <Tent className="h-3 w-3" />
          Camping
        </span>
      )}
    </span>
  );

  return (
    <li className="flex items-center gap-3 rounded-lg border border-sand px-3 py-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sand-light text-xs font-semibold text-charcoal-light/70">
        {index + 1}
      </span>
      {registration?.user ? (
        isSuperUser ? (
          <AssignDriverSlotModal
            mode="edit"
            driveId={driveId}
            driveTitle={driveTitle}
            driveDate={driveDate}
            targetRank={targetRank}
            hasSupervisingMarshal={hasSupervisingMarshal}
            registrationId={registration.id}
            currentRole={registration.role}
            member={registration.user}
            trigger={filledContent}
          />
        ) : (
          filledContent
        )
      ) : isSuperUser ? (
        <AssignDriverSlotModal
          mode="add"
          driveId={driveId}
          driveTitle={driveTitle}
          driveDate={driveDate}
          targetRank={targetRank}
          hasSupervisingMarshal={hasSupervisingMarshal}
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
      {registration?.user && isSuperUser && (
        <WhatsAppQuickAction user={registration.user} driveTitle={driveTitle} />
      )}
    </li>
  );
}

export function ConvoyRosterTab({
  leads,
  supports,
  drivers,
  slotCount,
  isSuperUser,
  driveId,
  driveTitle,
  driveDate,
  targetRank,
  maxDrivers,
  hasSupervisingMarshal,
}: {
  leads: Registration[];
  supports: Registration[];
  drivers: Registration[];
  slotCount: number;
  isSuperUser: boolean;
  driveId: string;
  driveTitle: string;
  driveDate: string;
  targetRank: number;
  maxDrivers: number;
  hasSupervisingMarshal: boolean;
}) {
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
            driveId={driveId}
            driveTitle={driveTitle}
            driveDate={driveDate}
            targetRank={targetRank}
            hasSupervisingMarshal={hasSupervisingMarshal}
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
            Lead
          </h3>
          <ul className="flex flex-col gap-2">
            {leads.map((r) => (
              <RegistrationRow
                key={r.id}
                registration={r}
                isSuperUser={isSuperUser}
                driveTitle={driveTitle}
                driveId={driveId}
                driveDate={driveDate}
                targetRank={targetRank}
                hasSupervisingMarshal={hasSupervisingMarshal}
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
                driveTitle={driveTitle}
                driveId={driveId}
                driveDate={driveDate}
                targetRank={targetRank}
                hasSupervisingMarshal={hasSupervisingMarshal}
              />
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
          Drivers ({drivers.length}/{maxDrivers})
        </h3>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: slotCount }).map((_, i) => (
            <SlotRow
              key={drivers[i]?.id ?? `empty-slot-${i}`}
              index={i}
              registration={drivers[i]}
              isSuperUser={isSuperUser}
              driveTitle={driveTitle}
              driveId={driveId}
              driveDate={driveDate}
              targetRank={targetRank}
              hasSupervisingMarshal={hasSupervisingMarshal}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
