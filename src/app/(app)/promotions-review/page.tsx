import { redirect } from "next/navigation";
import { Award } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState, EmptyState } from "@/components/club/StateMessage";
import { Tabs } from "@/components/club/Tabs";
import { ExamReviewCard, type ExamSubmissionReview } from "@/components/club/ExamReviewCard";
import { PromotionReadyCard, type PromotionReadyMember } from "@/components/club/PromotionReadyCard";
import { COMPASS_RANKS } from "@/lib/constants";

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
  examType: "R1_CATCH_THE_FLAG" | "R2_MAZE",
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
      .select("author_id, drive:drives(must_skills_covered)")
      .in("author_id", rookieIds)
      .eq("is_approved", true)
      .overrideTypes<
        { author_id: string; drive: { must_skills_covered: string[] | null } | null }[],
        { merge: false }
      >(),
    supabase
      .from("exam_submissions")
      .select("user_id, exam_type, status, created_at")
      .in("user_id", rookieIds)
      .order("created_at", { ascending: false })
      .overrideTypes<
        { user_id: string; exam_type: string; status: string; created_at: string }[],
        { merge: false }
      >(),
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

  const latestExamByUser = new Map<string, Map<string, string>>();
  for (const row of examRows ?? []) {
    const userExams = latestExamByUser.get(row.user_id) ?? new Map<string, string>();
    if (!userExams.has(row.exam_type)) {
      userExams.set(row.exam_type, row.status);
    }
    latestExamByUser.set(row.user_id, userExams);
  }

  const ready: PromotionReadyMember[] = [];
  for (const rookie of rookies) {
    const approvedCount = approvedCountByUser.get(rookie.id) ?? 0;
    const unlockedSkills = unlockedSkillsByUser.get(rookie.id) ?? new Set<string>();
    const userExams = latestExamByUser.get(rookie.id);

    const meetsDriveCount = approvedCount >= requiredCount;
    const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
    const meetsExams =
      userExams?.get("R1_CATCH_THE_FLAG") === "passed" && userExams?.get("R2_MAZE") === "passed";

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

  const activeTab = tab === "r2" ? "r2" : tab === "ready" ? "ready" : "r1";

  let error: string | null = null;
  let r1Submissions: ExamSubmissionReview[] = [];
  let r2Submissions: ExamSubmissionReview[] = [];
  let readyMembers: PromotionReadyMember[] = [];

  try {
    if (activeTab === "r1") {
      r1Submissions = await fetchPendingSubmissions(supabase, "R1_CATCH_THE_FLAG");
    } else if (activeTab === "r2") {
      r2Submissions = await fetchPendingSubmissions(supabase, "R2_MAZE");
    } else {
      readyMembers = await fetchReadyMembers(supabase);
    }
  } catch (err) {
    console.error("PAGE ERROR [promotions-review]:", err);
    error = "Couldn't load this tab right now.";
  }

  const tabs = [
    { key: "r1", label: "R1: Catch the Flag" },
    { key: "r2", label: "R2: Maze" },
    { key: "ready", label: "Ready for Intermediate" },
  ];

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
          Grade R1/R2 Rookie challenges and finalize Intermediate promotions.
        </p>
      </header>

      <Tabs tabs={tabs} defaultKey="r1" />

      {error ? (
        <ErrorState message={error} />
      ) : activeTab === "r1" ? (
        r1Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every R1 submission has already been reviewed." />
        ) : (
          <div className="flex flex-col gap-4">
            {r1Submissions.map((s) => (
              <ExamReviewCard key={s.id} submission={s} />
            ))}
          </div>
        )
      ) : activeTab === "r2" ? (
        r2Submissions.length === 0 ? (
          <EmptyState icon={Award} title="Nothing pending" message="Every R2 submission has already been reviewed." />
        ) : (
          <div className="flex flex-col gap-4">
            {r2Submissions.map((s) => (
              <ExamReviewCard key={s.id} submission={s} />
            ))}
          </div>
        )
      ) : readyMembers.length === 0 ? (
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
      )}
    </div>
  );
}
