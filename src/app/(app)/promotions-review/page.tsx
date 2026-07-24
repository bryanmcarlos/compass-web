import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState, EmptyState } from "@/components/club/StateMessage";
import { Tabs } from "@/components/club/Tabs";
import { ExamReviewCard, type ExamSubmissionReview } from "@/components/club/ExamReviewCard";
import {
  ChallengeAcceptancePanel,
  type CandidateExamDrive,
} from "@/components/club/ChallengeAcceptancePanel";
import { PromotionReadyCard, type PromotionReadyMember } from "@/components/club/PromotionReadyCard";
import {
  NewbiePromotionReadyCard,
  type NewbiePromotionReadyMember,
} from "@/components/club/NewbiePromotionReadyCard";
import {
  AdvancedPromotionReadyCard,
  type AdvancedPromotionReadyMember,
} from "@/components/club/AdvancedPromotionReadyCard";
import {
  MarshalPromotionReadyCard,
  type MarshalPromotionReadyMember,
} from "@/components/club/MarshalPromotionReadyCard";
import { COMPASS_RANKS } from "@/lib/constants";
import type { ExamType } from "@/app/(app)/profile/exams/actions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type SubmissionRow = {
  id: string;
  submission_notes: string;
  created_at: string;
  submitter: { username: string; full_name: string | null; avatar_url: string | null } | null;
  buddy: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

async function fetchPendingSubmissions(
  supabase: SupabaseServerClient,
  examType: ExamType,
): Promise<ExamSubmissionReview[]> {
  const { data } = await supabase
    .from("exam_submissions")
    .select(
      `id, submission_notes, created_at,
       submitter:profiles!exam_submissions_user_id_fkey(username, full_name, avatar_url),
       buddy:profiles!exam_submissions_buddy_id_fkey(username, full_name, avatar_url)`,
    )
    .eq("exam_type", examType)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .overrideTypes<SubmissionRow[], { merge: false }>();

  return (data ?? [])
    .filter((row) => row.submitter)
    .map((row) => ({
      id: row.id,
      submitterName: row.submitter!.full_name ?? row.submitter!.username,
      submitterAvatarUrl: row.submitter!.avatar_url,
      notes: row.submission_notes,
      createdAt: row.created_at,
      buddy: row.buddy
        ? { name: row.buddy.full_name ?? row.buddy.username, avatarUrl: row.buddy.avatar_url }
        : null,
    }));
}

/** Upcoming drives a Marshal can accept pending challenge submissions
 * into — Scheduled only (a Completed one is already done, too late to
 * accept anyone into it) and explicitly flagged with this exact exam_type
 * (see DriveForm's "Exam Type" field) — a plain Rookie drive with no flag
 * doesn't show up here even if the rank matches, so submissions only ever
 * get linked to a drive actually meant to be that exam. */
async function fetchCandidateExamDrives(
  supabase: SupabaseServerClient,
  examType: ExamType,
): Promise<CandidateExamDrive[]> {
  const { data } = await supabase
    .from("drives")
    .select("id, title, drive_id_code, drive_date")
    .eq("status", "Scheduled")
    .eq("exam_type", examType)
    .order("drive_date", { ascending: true });

  return (data ?? []).map((d) => ({
    id: d.id,
    title: d.title,
    driveIdCode: d.drive_id_code,
    driveDate: d.drive_date,
  }));
}

/** Mirrors fetchReadyMembers below exactly in shape, one stage earlier —
 * Newbie -> Rookie has no exam, so must-skills (incl. the gated "Intro to
 * ROK" drive) + equipment verification are the whole bar instead of R1/R2. */
async function fetchReadyForRookie(supabase: SupabaseServerClient): Promise<NewbiePromotionReadyMember[]> {
  const curriculum = COMPASS_RANKS[1];
  const requiredCount = curriculum.requiredDrives ?? 0;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const requiredMustSkills = (curriculum.mustSkills ?? []).filter((s) => s !== gatedSkill);
  const requiredEquipmentCount = curriculum.toolsRequired?.length ?? 0;

  const { data: newbies } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("current_rank", 1);

  if (!newbies || newbies.length === 0) return [];
  const newbieIds = newbies.map((n) => n.id);

  const [{ data: reportRows }, { data: equipmentRows }] = await Promise.all([
    supabase
      .from("trip_reports")
      .select("author_id, drive:drives(must_skills_covered)")
      .in("author_id", newbieIds)
      .eq("is_approved", true)
      .overrideTypes<
        { author_id: string; drive: { must_skills_covered: string[] | null } | null }[],
        { merge: false }
      >(),
    supabase
      .from("equipment_verifications")
      .select("user_id")
      .in("user_id", newbieIds)
      .eq("status", "verified")
      .overrideTypes<{ user_id: string }[], { merge: false }>(),
  ]);

  const approvedCountByUser = new Map<string, number>();
  const unlockedSkillsByUser = new Map<string, Set<string>>();
  for (const row of reportRows ?? []) {
    approvedCountByUser.set(row.author_id, (approvedCountByUser.get(row.author_id) ?? 0) + 1);
    const skills = unlockedSkillsByUser.get(row.author_id) ?? new Set<string>();
    for (const skill of row.drive?.must_skills_covered ?? []) {
      skills.add(skill);
    }
    unlockedSkillsByUser.set(row.author_id, skills);
  }

  const verifiedEquipmentCountByUser = new Map<string, number>();
  for (const row of equipmentRows ?? []) {
    verifiedEquipmentCountByUser.set(row.user_id, (verifiedEquipmentCountByUser.get(row.user_id) ?? 0) + 1);
  }

  const ready: NewbiePromotionReadyMember[] = [];
  for (const newbie of newbies) {
    const approvedCount = approvedCountByUser.get(newbie.id) ?? 0;
    const unlockedSkills = unlockedSkillsByUser.get(newbie.id) ?? new Set<string>();
    const verifiedEquipmentCount = verifiedEquipmentCountByUser.get(newbie.id) ?? 0;

    const meetsDriveCount = approvedCount >= requiredCount;
    const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
    const meetsEquipment = verifiedEquipmentCount >= requiredEquipmentCount;

    if (meetsDriveCount && meetsMustSkills && meetsEquipment) {
      ready.push({
        userId: newbie.id,
        name: newbie.full_name ?? newbie.username,
        avatarUrl: newbie.avatar_url,
        approvedCount,
        requiredCount,
        verifiedEquipmentCount,
        requiredEquipmentCount,
        introToRokDone: !gatedSkill || unlockedSkills.has(gatedSkill),
      });
    }
  }

  return ready;
}

async function fetchReadyMembers(supabase: SupabaseServerClient): Promise<PromotionReadyMember[]> {
  const curriculum = COMPASS_RANKS[2];
  const requiredCount = curriculum.requiredDrives ?? 0;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const requiredMustSkills = (curriculum.mustSkills ?? []).filter((s) => s !== gatedSkill);

  const { data: rookies } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("current_rank", 2);

  if (!rookies || rookies.length === 0) return [];
  const rookieIds = rookies.map((r) => r.id);

  const [{ data: reportRows }, { data: examRows }] = await Promise.all([
    supabase
      .from("trip_reports")
      .select("author_id, drive_id, drive:drives(must_skills_covered)")
      .in("author_id", rookieIds)
      .eq("is_approved", true)
      .overrideTypes<
        {
          author_id: string;
          drive_id: string | null;
          drive: { must_skills_covered: string[] | null } | null;
        }[],
        { merge: false }
      >(),
    supabase
      .from("exam_submissions")
      .select("user_id, exam_type, status, exam_drive_id, created_at")
      .in("user_id", rookieIds)
      .order("created_at", { ascending: false })
      .overrideTypes<
        {
          user_id: string;
          exam_type: string;
          status: string;
          exam_drive_id: string | null;
          created_at: string;
        }[],
        { merge: false }
      >(),
  ]);

  const approvedCountByUser = new Map<string, number>();
  const unlockedSkillsByUser = new Map<string, Set<string>>();
  const reportedDriveIdsByUser = new Map<string, Set<string>>();
  for (const row of reportRows ?? []) {
    approvedCountByUser.set(row.author_id, (approvedCountByUser.get(row.author_id) ?? 0) + 1);
    const skills = unlockedSkillsByUser.get(row.author_id) ?? new Set<string>();
    for (const skill of row.drive?.must_skills_covered ?? []) {
      skills.add(skill);
    }
    unlockedSkillsByUser.set(row.author_id, skills);
    if (row.drive_id) {
      const driveIds = reportedDriveIdsByUser.get(row.author_id) ?? new Set<string>();
      driveIds.add(row.drive_id);
      reportedDriveIdsByUser.set(row.author_id, driveIds);
    }
  }

  // Keyed by exam_type -> { status, examDriveId } per user, same shape as
  // promoteToIntermediate's own re-check — "passed" alone isn't enough,
  // each also needs its own approved trip report for its exam drive.
  const latestExamByUser = new Map<string, Map<string, { status: string; examDriveId: string | null }>>();
  for (const row of examRows ?? []) {
    const userExams = latestExamByUser.get(row.user_id) ?? new Map();
    if (!userExams.has(row.exam_type)) {
      userExams.set(row.exam_type, { status: row.status, examDriveId: row.exam_drive_id });
    }
    latestExamByUser.set(row.user_id, userExams);
  }

  const ready: PromotionReadyMember[] = [];
  for (const rookie of rookies) {
    const approvedCount = approvedCountByUser.get(rookie.id) ?? 0;
    const unlockedSkills = unlockedSkillsByUser.get(rookie.id) ?? new Set<string>();
    const reportedDriveIds = reportedDriveIdsByUser.get(rookie.id) ?? new Set<string>();
    const userExams = latestExamByUser.get(rookie.id);
    const r1 = userExams?.get("R1_CATCH_THE_FLAG");
    const r2 = userExams?.get("R2_MAZE");

    const meetsDriveCount = approvedCount >= requiredCount;
    const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
    const meetsExams =
      r1?.status === "passed" &&
      Boolean(r1.examDriveId && reportedDriveIds.has(r1.examDriveId)) &&
      r2?.status === "passed" &&
      Boolean(r2.examDriveId && reportedDriveIds.has(r2.examDriveId));

    if (meetsDriveCount && meetsMustSkills && meetsExams) {
      ready.push({
        userId: rookie.id,
        name: rookie.full_name ?? rookie.username,
        avatarUrl: rookie.avatar_url,
        approvedCount,
        requiredCount,
        introToIntDone: !gatedSkill || unlockedSkills.has(gatedSkill),
      });
    }
  }

  return ready;
}

const REQUIRED_SOLO_GPS_DRIVES = 3;
const REQUIRED_LEAD_DRIVES = 3;

/** Mirrors fetchReadyMembers exactly in shape, one stage later — no gated
 * final must-skill for this rank (COMPASS_RANKS[3] doesn't define one), so
 * unlike the Newbie/Rookie siblings this list has no separate "waiting on
 * one more drive" case; everyone listed is fully finalize-able. */
async function fetchReadyForAdvanced(supabase: SupabaseServerClient): Promise<AdvancedPromotionReadyMember[]> {
  const curriculum = COMPASS_RANKS[3];
  const requiredCount = curriculum.requiredDrives ?? 0;
  const requiredMustSkills = curriculum.mustSkills ?? [];

  const { data: intermediates } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("current_rank", 3);

  if (!intermediates || intermediates.length === 0) return [];
  const ids = intermediates.map((m) => m.id);

  const [{ data: reportRows }, { data: examRows }, { data: leadRows }] = await Promise.all([
    supabase
      .from("trip_reports")
      .select("author_id, drive:drives(must_skills_covered)")
      .in("author_id", ids)
      .eq("is_approved", true)
      .overrideTypes<
        { author_id: string; drive: { must_skills_covered: string[] | null } | null }[],
        { merge: false }
      >(),
    supabase
      .from("exam_submissions")
      .select("user_id, exam_type, status, created_at")
      .in("user_id", ids)
      .order("created_at", { ascending: false })
      .overrideTypes<
        { user_id: string; exam_type: string; status: string; created_at: string }[],
        { merge: false }
      >(),
    supabase.from("drive_registrations").select("user_id").in("user_id", ids).eq("role", "Lead"),
  ]);

  const approvedCountByUser = new Map<string, number>();
  const unlockedSkillsByUser = new Map<string, Set<string>>();
  for (const row of reportRows ?? []) {
    approvedCountByUser.set(row.author_id, (approvedCountByUser.get(row.author_id) ?? 0) + 1);
    const skills = unlockedSkillsByUser.get(row.author_id) ?? new Set<string>();
    for (const skill of row.drive?.must_skills_covered ?? []) {
      skills.add(skill);
    }
    unlockedSkillsByUser.set(row.author_id, skills);
  }

  const latestSingleExamByUser = new Map<string, Map<string, string>>();
  const soloGpsPassedCountByUser = new Map<string, number>();
  for (const row of examRows ?? []) {
    if (row.exam_type === "SOLO_GPS_DRIVE") {
      if (row.status === "passed") {
        soloGpsPassedCountByUser.set(row.user_id, (soloGpsPassedCountByUser.get(row.user_id) ?? 0) + 1);
      }
      continue;
    }
    const userExams = latestSingleExamByUser.get(row.user_id) ?? new Map<string, string>();
    if (!userExams.has(row.exam_type)) {
      userExams.set(row.exam_type, row.status);
    }
    latestSingleExamByUser.set(row.user_id, userExams);
  }

  const leadDriveCountByUser = new Map<string, number>();
  for (const row of leadRows ?? []) {
    leadDriveCountByUser.set(row.user_id, (leadDriveCountByUser.get(row.user_id) ?? 0) + 1);
  }

  const ready: AdvancedPromotionReadyMember[] = [];
  for (const member of intermediates) {
    const approvedCount = approvedCountByUser.get(member.id) ?? 0;
    const unlockedSkills = unlockedSkillsByUser.get(member.id) ?? new Set<string>();
    const userExams = latestSingleExamByUser.get(member.id);
    const soloGpsPassedCount = soloGpsPassedCountByUser.get(member.id) ?? 0;
    const leadDriveCount = leadDriveCountByUser.get(member.id) ?? 0;

    const meetsDriveCount = approvedCount >= requiredCount;
    const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
    const meetsChallenges =
      userExams?.get("I1_POINT_AND_SHOOT") === "passed" &&
      userExams?.get("I2_NIGHT_RECON") === "passed" &&
      userExams?.get("I3_KING_OF_THE_HILL") === "passed";
    const meetsSoloGps = soloGpsPassedCount >= REQUIRED_SOLO_GPS_DRIVES;
    const meetsLeadDrives = leadDriveCount >= REQUIRED_LEAD_DRIVES;

    if (meetsDriveCount && meetsMustSkills && meetsChallenges && meetsSoloGps && meetsLeadDrives) {
      ready.push({
        userId: member.id,
        name: member.full_name ?? member.username,
        avatarUrl: member.avatar_url,
        approvedCount,
        requiredCount,
        soloGpsPassedCount,
        leadDriveCount,
      });
    }
  }

  return ready;
}

/** The objective half of Advanced -> Marshal — supervised leads (via the
 * same approved-trip-report count every other rank uses for its threshold,
 * matching profile/page.tsx's existing convention) + must-skills. The 3
 * governance attestations are read directly off `profiles` here (not
 * re-derived), since they're a Marshal's own recorded input, not computed
 * from other data — MarshalPromotionReadyCard shows every rank-4 member
 * meeting the objective bar regardless of attestation state, so a Marshal
 * can see who's getting close and start checking boxes as each real-world
 * step happens. */
async function fetchReadyForMarshal(supabase: SupabaseServerClient): Promise<MarshalPromotionReadyMember[]> {
  const curriculum = COMPASS_RANKS[4];
  const requiredCount = curriculum.requiredSupervisedLeads ?? 0;
  const requiredMustSkills = curriculum.mustSkills ?? [];

  const { data: advanced } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, marshalship_training_endorsed, marshalship_vote_passed, marshalship_final_assessment_passed",
    )
    .eq("current_rank", 4);

  if (!advanced || advanced.length === 0) return [];
  const ids = advanced.map((m) => m.id);

  const { data: reportRows } = await supabase
    .from("trip_reports")
    .select("author_id, drive:drives(must_skills_covered)")
    .in("author_id", ids)
    .eq("is_approved", true)
    .overrideTypes<
      { author_id: string; drive: { must_skills_covered: string[] | null } | null }[],
      { merge: false }
    >();

  const approvedCountByUser = new Map<string, number>();
  const unlockedSkillsByUser = new Map<string, Set<string>>();
  for (const row of reportRows ?? []) {
    approvedCountByUser.set(row.author_id, (approvedCountByUser.get(row.author_id) ?? 0) + 1);
    const skills = unlockedSkillsByUser.get(row.author_id) ?? new Set<string>();
    for (const skill of row.drive?.must_skills_covered ?? []) {
      skills.add(skill);
    }
    unlockedSkillsByUser.set(row.author_id, skills);
  }

  const ready: MarshalPromotionReadyMember[] = [];
  for (const member of advanced) {
    const approvedCount = approvedCountByUser.get(member.id) ?? 0;
    const unlockedSkills = unlockedSkillsByUser.get(member.id) ?? new Set<string>();

    const meetsDriveCount = approvedCount >= requiredCount;
    const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));

    if (meetsDriveCount && meetsMustSkills) {
      ready.push({
        userId: member.id,
        name: member.full_name ?? member.username,
        avatarUrl: member.avatar_url,
        approvedCount,
        requiredCount,
        trainingEndorsed: member.marshalship_training_endorsed ?? false,
        votePassed: member.marshalship_vote_passed ?? false,
        finalAssessmentPassed: member.marshalship_final_assessment_passed ?? false,
      });
    }
  }

  return ready;
}

export default async function PromotionsReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to review promotions.");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("is_marshal, is_admin")
    .eq("id", user.id)
    .single();

  if (!viewerProfile?.is_marshal && !viewerProfile?.is_admin) {
    redirect("/");
  }

  const tabs = [
    { key: "nwb-ready", label: "Ready for Rookie" },
    { key: "r1", label: "R1: Catch the Flag" },
    { key: "r2", label: "R2: Maze" },
    { key: "ready", label: "Ready for Intermediate" },
    { key: "i1", label: "I1: Point & Shoot" },
    { key: "i2", label: "I2: Night Recon" },
    { key: "i3", label: "I3: King of the Hill" },
    { key: "solo-gps", label: "Solo GPS Drives" },
    { key: "adv-ready", label: "Ready for Advanced" },
    { key: "mar-ready", label: "Ready for Marshal" },
  ];
  const activeTab = tabs.some((t) => t.key === tab) ? tab! : "nwb-ready";

  let error: string | null = null;
  let r1Submissions: ExamSubmissionReview[] = [];
  let r2Submissions: ExamSubmissionReview[] = [];
  let candidateExamDrives: CandidateExamDrive[] = [];
  let i1Submissions: ExamSubmissionReview[] = [];
  let i2Submissions: ExamSubmissionReview[] = [];
  let i3Submissions: ExamSubmissionReview[] = [];
  let soloGpsSubmissions: ExamSubmissionReview[] = [];
  let readyMembers: PromotionReadyMember[] = [];
  let readyNewbies: NewbiePromotionReadyMember[] = [];
  let readyAdvanced: AdvancedPromotionReadyMember[] = [];
  let readyMarshals: MarshalPromotionReadyMember[] = [];

  try {
    if (activeTab === "r1") {
      [r1Submissions, candidateExamDrives] = await Promise.all([
        fetchPendingSubmissions(supabase, "R1_CATCH_THE_FLAG"),
        fetchCandidateExamDrives(supabase, "R1_CATCH_THE_FLAG"),
      ]);
    } else if (activeTab === "r2") {
      [r2Submissions, candidateExamDrives] = await Promise.all([
        fetchPendingSubmissions(supabase, "R2_MAZE"),
        fetchCandidateExamDrives(supabase, "R2_MAZE"),
      ]);
    } else if (activeTab === "i1") {
      [i1Submissions, candidateExamDrives] = await Promise.all([
        fetchPendingSubmissions(supabase, "I1_POINT_AND_SHOOT"),
        fetchCandidateExamDrives(supabase, "I1_POINT_AND_SHOOT"),
      ]);
    } else if (activeTab === "i2") {
      [i2Submissions, candidateExamDrives] = await Promise.all([
        fetchPendingSubmissions(supabase, "I2_NIGHT_RECON"),
        fetchCandidateExamDrives(supabase, "I2_NIGHT_RECON"),
      ]);
    } else if (activeTab === "i3") {
      [i3Submissions, candidateExamDrives] = await Promise.all([
        fetchPendingSubmissions(supabase, "I3_KING_OF_THE_HILL"),
        fetchCandidateExamDrives(supabase, "I3_KING_OF_THE_HILL"),
      ]);
    } else if (activeTab === "solo-gps") {
      soloGpsSubmissions = await fetchPendingSubmissions(supabase, "SOLO_GPS_DRIVE");
    } else if (activeTab === "ready") {
      readyMembers = await fetchReadyMembers(supabase);
    } else if (activeTab === "adv-ready") {
      readyAdvanced = await fetchReadyForAdvanced(supabase);
    } else if (activeTab === "mar-ready") {
      readyMarshals = await fetchReadyForMarshal(supabase);
    } else {
      readyNewbies = await fetchReadyForRookie(supabase);
    }
  } catch (err) {
    console.error("PAGE ERROR [promotions-review]:", err);
    error = "Couldn't load this tab right now.";
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Award className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Promotions Review
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Grade challenges and finalize promotions across every rank.
        </p>
      </header>

      <Tabs tabs={tabs} defaultKey="nwb-ready" />

      {error ? (
        <ErrorState message={error} />
      ) : activeTab === "r1" ? (
        r1Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every R1 submission has already been reviewed." />
        ) : (
          <ChallengeAcceptancePanel
            submissions={r1Submissions}
            candidateDrives={candidateExamDrives}
            examType="R1_CATCH_THE_FLAG"
            examLabel="R1: Catch the Flag"
          />
        )
      ) : activeTab === "r2" ? (
        r2Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every R2 submission has already been reviewed." />
        ) : (
          <ChallengeAcceptancePanel
            submissions={r2Submissions}
            candidateDrives={candidateExamDrives}
            examType="R2_MAZE"
            examLabel="R2: Maze"
          />
        )
      ) : activeTab === "i1" ? (
        i1Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every I1 submission has already been reviewed." />
        ) : (
          <ChallengeAcceptancePanel
            submissions={i1Submissions}
            candidateDrives={candidateExamDrives}
            examType="I1_POINT_AND_SHOOT"
            examLabel="I1: Point & Shoot"
          />
        )
      ) : activeTab === "i2" ? (
        i2Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every I2 submission has already been reviewed." />
        ) : (
          <ChallengeAcceptancePanel
            submissions={i2Submissions}
            candidateDrives={candidateExamDrives}
            examType="I2_NIGHT_RECON"
            examLabel="I2: Night Recon"
          />
        )
      ) : activeTab === "i3" ? (
        i3Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every I3 submission has already been reviewed." />
        ) : (
          <ChallengeAcceptancePanel
            submissions={i3Submissions}
            candidateDrives={candidateExamDrives}
            examType="I3_KING_OF_THE_HILL"
            examLabel="I3: King of the Hill"
          />
        )
      ) : activeTab === "solo-gps" ? (
        soloGpsSubmissions.length === 0 ? (
          <EmptyState
            icon={Award}
            title="Nothing pending"
            message="Every solo GPS drive submission has already been reviewed."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {soloGpsSubmissions.map((s) => (
              <ExamReviewCard key={s.id} submission={s} />
            ))}
          </div>
        )
      ) : activeTab === "ready" ? (
        readyMembers.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No one ready yet"
            message="Once a Rookie clears their drives, must-skills, and both exams, they'll show up here."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {readyMembers.map((m) => (
              <PromotionReadyCard key={m.userId} member={m} />
            ))}
          </div>
        )
      ) : activeTab === "adv-ready" ? (
        readyAdvanced.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No one ready yet"
            message="Once an Intermediate member clears their drives, must-skills, I1/I2/I3, solo GPS drives, and lead drives, they'll show up here."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {readyAdvanced.map((m) => (
              <AdvancedPromotionReadyCard key={m.userId} member={m} />
            ))}
          </div>
        )
      ) : activeTab === "mar-ready" ? (
        readyMarshals.length === 0 ? (
          <EmptyState
            icon={Award}
            title="No one ready yet"
            message="Once an Advanced member clears their supervised leads and must-skills, they'll show up here to attest and finalize."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {readyMarshals.map((m) => (
              <MarshalPromotionReadyCard key={m.userId} member={m} />
            ))}
          </div>
        )
      ) : readyNewbies.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No one ready yet"
          message="Once a Newbie clears their drives, must-skills (incl. Intro to ROK), and equipment verification, they'll show up here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {readyNewbies.map((m) => (
            <NewbiePromotionReadyCard key={m.userId} member={m} />
          ))}
        </div>
      )}
    </div>
  );
}
