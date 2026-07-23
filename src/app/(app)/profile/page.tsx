import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, Lock, Award, CircleCheck, Circle, Wrench } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import { AvatarUploadForm } from "@/components/club/AvatarUploadForm";
import { RankBadge } from "@/components/club/RankBadge";
import { RequestPromotionButton } from "@/components/club/RequestPromotionButton";
import { EditProfileForm } from "@/components/club/EditProfileForm";
import { SignOutButton } from "@/components/club/SignOutButton";
import { CLUB_CONFIG, COMPASS_RANKS } from "@/lib/constants";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to view your profile.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, current_rank, mobile_number, car_details",
    )
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <ErrorState message="Couldn't load your profile right now. Please try again shortly." />
      </div>
    );
  }

  const { data: approvedReportsData, error: countError } = await supabase
    .from("trip_reports")
    .select("id, drive:drives(must_skills_covered)")
    .eq("author_id", profile.id)
    .eq("is_approved", true)
    .overrideTypes<
      { id: string; drive: { must_skills_covered: string[] | null } | null }[],
      { merge: false }
    >();

  const approvedReports = approvedReportsData ?? [];
  const approvedDrives = approvedReports.length;

  // Each approved trip report unlocks whatever curriculum skills its drive
  // addressed, regardless of which rank tier that drive targeted — a marshal
  // may cover a skill on any drive if the opportunity comes up.
  const unlockedSkills = new Set<string>();
  for (const report of approvedReports) {
    for (const skill of report.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }

  const currentRank =
    CLUB_CONFIG.ranks.find((r) => r.level === profile.current_rank) ??
    CLUB_CONFIG.ranks[0];
  const nextRank =
    CLUB_CONFIG.ranks.find((r) => r.level === currentRank.level + 1) ?? null;

  const curriculum = COMPASS_RANKS[currentRank.level as 1 | 2 | 3 | 4 | 5];
  const mustSkills = curriculum?.mustSkills ?? [];
  const skillsUnlockedCount = mustSkills.filter((s) =>
    unlockedSkills.has(s),
  ).length;
  const isLeadTrack = curriculum?.requiredSupervisedLeads !== undefined;
  const metricLabel = isLeadTrack ? "Supervised Leads" : "Approved Drives";

  const threshold =
    curriculum?.requiredDrives ??
    curriculum?.requiredSupervisedLeads ??
    CLUB_CONFIG.rules.requiredDrivesForPromotion;

  // Equipment verification only gates the ranks whose curriculum actually
  // lists toolsRequired (today, just Newbie -> Rookie) — data-driven off
  // the same curriculum object rather than hardcoded to rank 1, so a future
  // rank with its own toolsRequired picks this up automatically.
  const requiredEquipmentCount = curriculum?.toolsRequired?.length ?? 0;
  let verifiedEquipmentCount = 0;
  if (requiredEquipmentCount > 0) {
    const { count } = await supabase
      .from("equipment_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "verified");
    verifiedEquipmentCount = count ?? 0;
  }
  const equipmentQualifies = verifiedEquipmentCount >= requiredEquipmentCount;

  // Previously ignored entirely — a member could see the promotion button
  // with must-skills (including a gated final drive like "Intro to ROK")
  // still incomplete, as long as drives + equipment were done.
  const mustSkillsQualify = mustSkills.length === 0 || skillsUnlockedCount === mustSkills.length;

  const qualifies =
    nextRank !== null && approvedDrives >= threshold && equipmentQualifies && mustSkillsQualify;
  const progressPct = nextRank
    ? Math.min((approvedDrives / threshold) * 100, 100)
    : 100;

  // A rank with its own `challenges` (today, just Rookie's R1/R2) has a
  // dedicated review flow elsewhere (/profile/exams + /promotions-review) —
  // the generic drives-only section below doesn't apply and would just be a
  // redundant, dead-end second path for the same promotion.
  const hasDedicatedExamTrack = Boolean(curriculum?.challenges);

  const promotionLabel = nextRank
    ? requiredEquipmentCount > 0
      ? `Submit Equipment & Drive Verification for ${nextRank.title}`
      : `Request Promotion to ${nextRank.title}`
    : "";

  let hasPendingRequest = false;
  if (nextRank) {
    const { data: pendingRequest } = await supabase
      .from("promotion_requests")
      .select("id")
      .eq("candidate_id", profile.id)
      .eq("target_rank", nextRank.level)
      .eq("status", "Pending")
      .maybeSingle();
    hasPendingRequest = Boolean(pendingRequest);
  }

  const displayName = profile.full_name ?? profile.username;
  const remaining = Math.max(threshold - approvedDrives, 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-sand bg-off-white p-6 text-center shadow-sm sm:p-8">
        <AvatarUploadForm name={displayName} avatarUrl={profile.avatar_url} />
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-xl font-bold text-charcoal">{displayName}</h1>
          <p className="text-sm text-charcoal-light/70">@{profile.username}</p>
          <RankBadge
            rank={currentRank.title}
            className="mt-1 text-sm"
            size="xs"
          />
        </div>
        <p className="max-w-sm text-sm text-charcoal-light/80">
          {currentRank.description}
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8">
        <header className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-light text-forest">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-charcoal">
              Progression
            </h2>
            <p className="text-sm text-charcoal-light/80">
              {nextRank
                ? `Approved trip reports toward ${nextRank.title}`
                : "You've reached the top rank"}
            </p>
          </div>
        </header>

        {countError && (
          <ErrorState message="Couldn't load your approved trip report count. Progress shown may be out of date." />
        )}

        {profile.current_rank === 0 ? (
          // Members don't track toward Newbie via approved-drive count —
          // they're auto-promoted on their first trip report for their one
          // Newbie orientation drive (see submitTripReport), so the usual
          // progress-bar/must-skills UI below (built around
          // requiredDrivesForPromotion) doesn't apply to this rank at all.
          <div className="flex items-start gap-2 rounded-lg bg-sand-light px-3 py-2.5 text-sm text-charcoal-light/90">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-light/60" />
            <span>
              Register for a Newbie orientation drive and submit your trip
              report afterward to become a Newbie member.
            </span>
          </div>
        ) : nextRank && hasDedicatedExamTrack ? (
          <div className="flex items-start gap-2 rounded-lg bg-sand-light px-3 py-2.5 text-sm text-charcoal-light/90">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-light/60" />
            <span>
              Complete your R1 and R2 challenges to progress to {nextRank.title} — track your
              progress under{" "}
              <Link href="/profile/exams" className="font-medium text-forest hover:underline">
                Exams
              </Link>
              .
            </span>
          </div>
        ) : nextRank ? (
          <>
            <p className="text-sm font-semibold text-charcoal">
              {metricLabel}: {Math.min(approvedDrives, threshold)}/{threshold}
              {mustSkills.length > 0 && (
                <>
                  {" "}
                  | Skills: {skillsUnlockedCount}/{mustSkills.length} Unlocked
                </>
              )}
            </p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-charcoal">
                {Math.min(approvedDrives, threshold)} / {threshold}{" "}
                {metricLabel} to qualify for {nextRank.title} Examination
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-sand-light">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: `var(${nextRank.colorVar})`,
                }}
              />
            </div>

            {mustSkills.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-sand pt-4">
                <h3 className="text-sm font-semibold text-charcoal">
                  {currentRank.title} Must Skills
                </h3>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {mustSkills.map((skill) => {
                    const done = unlockedSkills.has(skill);
                    return (
                      <li
                        key={skill}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          done
                            ? "border-forest/30 bg-forest/5 text-forest-dark"
                            : "border-sand bg-sand-light text-charcoal-light/70"
                        }`}
                      >
                        {done ? (
                          <CircleCheck className="h-4 w-4 shrink-0 text-forest" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-charcoal-light/40" />
                        )}
                        {skill}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {requiredEquipmentCount > 0 && (
              <div className="flex flex-col gap-2 border-t border-sand pt-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-charcoal">
                    Equipment Verification
                  </h3>
                  <span className="text-xs font-medium text-charcoal-light/70">
                    {verifiedEquipmentCount}/{requiredEquipmentCount} Verified
                  </span>
                </div>
                <Link
                  href="/profile/equipment"
                  className="flex w-fit items-center gap-1.5 rounded-lg border border-sand bg-sand-light px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-primary/50"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {equipmentQualifies ? "View Equipment Checklist" : "Go to Equipment Checklist"}
                </Link>
              </div>
            )}

            {qualifies ? (
              <RequestPromotionButton
                targetRank={nextRank.level}
                label={promotionLabel}
                alreadyPending={hasPendingRequest}
              />
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-sand-light px-3 py-2.5 text-sm text-charcoal-light/90">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-charcoal-light/60" />
                <span>
                  {remaining > 0 && (
                    <>
                      Submit {remaining} more approved trip report
                      {remaining === 1 ? "" : "s"} to progress toward {nextRank.title}.
                    </>
                  )}
                  {remaining > 0 && !mustSkillsQualify && " "}
                  {!mustSkillsQualify && (
                    <>
                      Complete {mustSkills.length - skillsUnlockedCount} more must-skill
                      {mustSkills.length - skillsUnlockedCount === 1 ? "" : "s"} to progress toward{" "}
                      {nextRank.title}.
                    </>
                  )}
                  {(remaining > 0 || !mustSkillsQualify) && !equipmentQualifies && " "}
                  {!equipmentQualifies && (
                    <>
                      Verify {requiredEquipmentCount - verifiedEquipmentCount} more equipment
                      item{requiredEquipmentCount - verifiedEquipmentCount === 1 ? "" : "s"} to
                      progress toward {nextRank.title}.
                    </>
                  )}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-forest/10 px-3 py-2.5 text-sm text-forest-dark">
            <Award className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              You hold the highest rank in the club. Thank you for leading
              the way.
            </span>
          </div>
        )}
      </section>

      <EditProfileForm
        mobileNumber={profile.mobile_number}
        carDetails={profile.car_details}
      />

      <SignOutButton />
    </div>
  );
}
