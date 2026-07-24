import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Flag, CircleCheck, Circle, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import { ExamSubmissionForm, type ExamStatus, type BuddyOption } from "@/components/club/ExamSubmissionForm";
import { SoloGpsDriveForm } from "@/components/club/SoloGpsDriveForm";
import { COMPASS_RANKS, DRIVE_COUNT_REGISTRATION_GATE_START } from "@/lib/constants";

const RANK_TITLES: Record<number, string> = { 2: "Rookie", 3: "Intermediate" };
const REQUIRED_LEAD_DRIVES = 3;

export default async function ExamsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to view your exam submissions.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_rank")
    .eq("id", user.id)
    .single();

  // Only a Rookie (R1/R2) or an Intermediate member (I1/I2/I3 + solo GPS
  // drives) has anything to submit here — anyone else is sent back, same
  // convention as a non-marshal hitting a review-only tab.
  const rank = profile?.current_rank;
  if (rank !== 2 && rank !== 3) {
    redirect("/profile");
  }

  const [
    { data: submissions, error },
    { data: memberRows },
    { data: reportRows },
    { count: leadDriveCount },
    { data: registrationRows },
  ] = await Promise.all([
    supabase
      .from("exam_submissions")
      .select("exam_type, status, drive:drives!exam_submissions_exam_drive_id_fkey(id, title, drive_id_code)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<
        {
          exam_type: string;
          status: ExamStatus;
          drive: { id: string; title: string; drive_id_code: string } | null;
        }[],
        { merge: false }
      >(),
    // Only R1 needs a buddy — fetched regardless of rank for simplicity,
    // unused (and harmless) when rank 3 renders I1/I2/I3 instead.
    supabase
      .from("profiles")
      .select("id, username, full_name")
      .eq("is_disabled", false)
      .neq("id", user.id)
      .order("username"),
    // Same signal used everywhere else this app tracks progression —
    // approved trip reports and the must-skills their drives covered.
    supabase
      .from("trip_reports")
      .select(
        "drive_id, created_at, drive:drives(must_skills_covered, target_rank, is_all_levels)",
      )
      .eq("author_id", user.id)
      .eq("is_approved", true)
      .overrideTypes<
        {
          drive_id: string | null;
          created_at: string;
          drive: {
            must_skills_covered: string[] | null;
            target_rank: number;
            is_all_levels: boolean;
          } | null;
        }[],
        { merge: false }
      >(),
    // "3 Intro Lead Drives" needs no submission UI at all — it's just
    // however many times this member has already registered as Lead.
    supabase
      .from("drive_registrations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "Lead"),
    // Used to filter reportRows below — see the comment there.
    supabase.from("drive_registrations").select("drive_id").eq("user_id", user.id),
  ]);

  // A trip report submitted on/after DRIVE_COUNT_REGISTRATION_GATE_START
  // only counts toward the drive requirement if this member also has a
  // matching drive_registrations row for that same drive — see that
  // constant's comment for why older reports are grandfathered in
  // unconditionally.
  const registeredDriveIds = new Set((registrationRows ?? []).map((r) => r.drive_id));
  const qualifyingReportRows = (reportRows ?? []).filter(
    (r) =>
      r.created_at < DRIVE_COUNT_REGISTRATION_GATE_START ||
      (r.drive_id !== null && registeredDriveIds.has(r.drive_id)),
  );

  const latestByType = new Map<string, ExamStatus>();
  const examDriveByType = new Map<string, { id: string; title: string; driveIdCode: string } | null>();
  for (const row of submissions ?? []) {
    if (!latestByType.has(row.exam_type)) {
      latestByType.set(row.exam_type, row.status);
      examDriveByType.set(
        row.exam_type,
        row.drive ? { id: row.drive.id, title: row.drive.title, driveIdCode: row.drive.drive_id_code } : null,
      );
    }
  }

  // R2 additionally unlocks only once R1 is passed AND reported — mirrors
  // checkR1PassedAndReported in actions.ts, the real server-side gate; this
  // is purely so the UI can explain the lock rather than a generic message.
  const r1ExamDrive = examDriveByType.get("R1_CATCH_THE_FLAG");
  const r1PassedAndReported =
    latestByType.get("R1_CATCH_THE_FLAG") === "passed" &&
    Boolean(r1ExamDrive) &&
    (reportRows ?? []).some((r) => r.drive_id === r1ExamDrive!.id);

  const soloGpsSubmissions = (submissions ?? []).filter((s) => s.exam_type === "SOLO_GPS_DRIVE");
  const soloGpsPassedCount = soloGpsSubmissions.filter((s) => s.status === "passed").length;
  const soloGpsHasPending = soloGpsSubmissions.some((s) => s.status === "pending");

  const buddyOptions: BuddyOption[] = (memberRows ?? []).map((m) => ({
    id: m.id,
    name: m.full_name ?? m.username,
  }));

  // Challenges are only unlocked once the required drives and every
  // regular must-skill are done, per the club roadmap — a rank's own
  // gatedFinalMustSkill (if any) is deliberately excluded here, since that
  // drive itself only unlocks *after* passing the challenges below.
  const curriculum = COMPASS_RANKS[rank as 2 | 3];
  const requiredDrives = curriculum.requiredDrives ?? 0;
  const unlockedSkills = new Set<string>();
  for (const row of qualifyingReportRows) {
    for (const skill of row.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }
  // Unlike skill unlocking above, the drive *count* is scoped to this
  // member's current rank tier (or an all-levels drive) — otherwise reports
  // from a lower-tier drive that already earned their last promotion (e.g.
  // Newbie-tier reports used to reach Rookie) keep counting toward this
  // one too, so a member can land on their new rank already showing "X/5"
  // with zero drives actually done at this tier.
  const approvedDrives = qualifyingReportRows.filter(
    (r) => r.drive?.target_rank === rank || r.drive?.is_all_levels,
  ).length;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const mustSkills = curriculum.mustSkills ?? [];
  const regularMustSkills = mustSkills.filter((s) => s !== gatedSkill);
  const meetsDriveCount = approvedDrives >= requiredDrives;
  const meetsMustSkills = regularMustSkills.every((s) => unlockedSkills.has(s));
  const challengesUnlocked = meetsDriveCount && meetsMustSkills;
  const gatedSkillDone = !gatedSkill || unlockedSkills.has(gatedSkill);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/profile"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-charcoal-light/70 hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Flag className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            {RANK_TITLES[rank]} Challenges
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          {rank === 2
            ? "Pass both R1 and R2 to unlock the Intro to INT drive and finalize your promotion to Intermediate."
            : "Pass I1, I2, and I3, log your 3 solo GPS drives, and lead 3 drives to finalize your promotion to Advanced."}
        </p>
      </header>

      {error ? (
        <ErrorState message="Couldn't load your exam submissions right now. Please try again shortly." />
      ) : (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-charcoal">
              {RANK_TITLES[rank]} Requirements: {Math.min(approvedDrives, requiredDrives)}/{requiredDrives} Drives
            </h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {mustSkills.map((skill) => {
                const done = unlockedSkills.has(skill);
                const isGated = skill === gatedSkill;
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
                    {isGated && (
                      <span className="ml-auto text-[10px] font-semibold text-charcoal-light/50 uppercase">
                        after challenges
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {rank === 2 ? (
            <>
              <ExamSubmissionForm
                examType="R1_CATCH_THE_FLAG"
                title="R1: Catch the Flag"
                description="Buddy-system challenge — mention your buddy's name in your challenge post, then name them here. Once a Marshal accepts your submission, you'll be registered onto the exam drive where it's graded."
                status={latestByType.get("R1_CATCH_THE_FLAG") ?? "not_submitted"}
                requiresBuddy
                buddyOptions={buddyOptions}
                locked={!challengesUnlocked}
                examDrive={examDriveByType.get("R1_CATCH_THE_FLAG") ?? null}
              />
              <ExamSubmissionForm
                examType="R2_MAZE"
                title="R2: Maze"
                description="Individual challenge. Unlocks once R1 is passed and reported."
                status={latestByType.get("R2_MAZE") ?? "not_submitted"}
                requiresBuddy={false}
                buddyOptions={[]}
                locked={!challengesUnlocked || !r1PassedAndReported}
                lockedReason={
                  !challengesUnlocked
                    ? undefined
                    : "Unlocks once you've passed R1 on its exam drive and submitted an approved trip report for it."
                }
                examDrive={examDriveByType.get("R2_MAZE") ?? null}
              />

              {challengesUnlocked && !gatedSkillDone && (
                <p className="text-center text-xs text-charcoal-light/70">
                  Pass both challenges above to unlock the Intro to INT drive — your Marshal will
                  run it once you have.
                </p>
              )}
            </>
          ) : (
            <>
              <ExamSubmissionForm
                examType="I1_POINT_AND_SHOOT"
                title="I1: Point & Shoot"
                description="Solo day drive focusing on compass bearing."
                status={latestByType.get("I1_POINT_AND_SHOOT") ?? "not_submitted"}
                requiresBuddy={false}
                buddyOptions={[]}
                locked={!challengesUnlocked}
              />
              <ExamSubmissionForm
                examType="I2_NIGHT_RECON"
                title="I2: Night Recon"
                description="Solo night drive focusing on GPS navigation."
                status={latestByType.get("I2_NIGHT_RECON") ?? "not_submitted"}
                requiresBuddy={false}
                buddyOptions={[]}
                locked={!challengesUnlocked}
              />
              <ExamSubmissionForm
                examType="I3_KING_OF_THE_HILL"
                title="I3: King of the Hill"
                description="Located in Liwa."
                status={latestByType.get("I3_KING_OF_THE_HILL") ?? "not_submitted"}
                requiresBuddy={false}
                buddyOptions={[]}
                locked={!challengesUnlocked}
              />

              <SoloGpsDriveForm
                passedCount={soloGpsPassedCount}
                hasPending={soloGpsHasPending}
                locked={!challengesUnlocked}
              />

              <section className="flex items-center justify-between gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-forest" />
                  <span className="text-sm font-semibold text-charcoal">3 Intro Lead Drives</span>
                </div>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    (leadDriveCount ?? 0) >= REQUIRED_LEAD_DRIVES
                      ? "bg-forest/10 text-forest"
                      : "bg-sand-light text-charcoal-light/70"
                  }`}
                >
                  {(leadDriveCount ?? 0) >= REQUIRED_LEAD_DRIVES && <CircleCheck className="h-3.5 w-3.5" />}
                  {Math.min(leadDriveCount ?? 0, REQUIRED_LEAD_DRIVES)}/{REQUIRED_LEAD_DRIVES} Led
                </span>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
