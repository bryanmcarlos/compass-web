"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { COMPASS_RANKS } from "@/lib/constants";

export type PromotionsReviewActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function requireReviewer(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null as null, error: "You need to be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_marshal, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_marshal && !profile?.is_admin) {
    return { user: null as null, error: "Only Marshals and Admins can review promotions." };
  }

  return { user, error: null as null };
}

export async function gradeExam(
  submissionId: string,
  status: "passed" | "failed",
): Promise<PromotionsReviewActionState> {
  const supabase = await createClient();
  const { user, error: authError } = await requireReviewer(supabase);
  if (authError || !user) {
    return { status: "error", message: authError };
  }

  if (status !== "passed" && status !== "failed") {
    return { status: "error", message: "Invalid grade." };
  }

  const { error } = await supabase
    .from("exam_submissions")
    .update({
      status,
      graded_by: user.id,
      graded_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  if (error) {
    console.error("SERVER ACTION ERROR [gradeExam]:", error);
    return { status: "error", message: "Couldn't grade that submission. Please try again." };
  }

  revalidatePath("/promotions-review");
  revalidatePath("/profile/exams");

  return {
    status: "success",
    message: status === "passed" ? "Marked as passed." : "Resubmission requested.",
  };
}

/** Re-derives and re-verifies every promotion criterion server-side rather
 * than trusting the Tab 3 list the button was clicked from — same
 * reasoning as every other Server Action in this codebase never trusting
 * client-passed state for something this consequential. */
export async function promoteToIntermediate(userId: string): Promise<PromotionsReviewActionState> {
  const supabase = await createClient();
  const { error: authError } = await requireReviewer(supabase);
  if (authError) {
    return { status: "error", message: authError };
  }

  const { data: candidate } = await supabase
    .from("profiles")
    .select("current_rank, username, full_name")
    .eq("id", userId)
    .single();

  if (!candidate || candidate.current_rank !== 2) {
    return { status: "error", message: "This member isn't currently a Rookie." };
  }

  const curriculum = COMPASS_RANKS[2];
  const requiredCount = curriculum.requiredDrives ?? 0;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const requiredMustSkills = (curriculum.mustSkills ?? []).filter((s) => s !== gatedSkill);

  const [{ count: approvedCount }, { data: reportRows }, { data: examRows }] = await Promise.all([
    supabase
      .from("trip_reports")
      .select("id", { count: "exact", head: true })
      .eq("author_id", userId)
      .eq("is_approved", true),
    supabase
      .from("trip_reports")
      .select("drive:drives(must_skills_covered)")
      .eq("author_id", userId)
      .eq("is_approved", true)
      .overrideTypes<{ drive: { must_skills_covered: string[] | null } | null }[], { merge: false }>(),
    supabase
      .from("exam_submissions")
      .select("exam_type, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<
        { exam_type: "R1_CATCH_THE_FLAG" | "R2_MAZE"; status: string; created_at: string }[],
        { merge: false }
      >(),
  ]);

  const unlockedSkills = new Set<string>();
  for (const report of reportRows ?? []) {
    for (const skill of report.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }

  const latestExamStatus = new Map<string, string>();
  for (const row of examRows ?? []) {
    if (!latestExamStatus.has(row.exam_type)) {
      latestExamStatus.set(row.exam_type, row.status);
    }
  }

  const meetsDriveCount = (approvedCount ?? 0) >= requiredCount;
  const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
  const meetsExams =
    latestExamStatus.get("R1_CATCH_THE_FLAG") === "passed" &&
    latestExamStatus.get("R2_MAZE") === "passed";
  const meetsIntroToInt = !gatedSkill || unlockedSkills.has(gatedSkill);

  if (!meetsDriveCount || !meetsMustSkills || !meetsExams || !meetsIntroToInt) {
    return {
      status: "error",
      message: "This member no longer meets every promotion requirement — refresh and check again.",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ current_rank: 3 })
    .eq("id", userId);

  if (updateError) {
    console.error("SERVER ACTION ERROR [promoteToIntermediate]:", updateError);
    return { status: "error", message: "Couldn't finalize this promotion. Please try again." };
  }

  // Best-effort — a Rookie who never clicked "Request Intermediate
  // Examination" simply has no matching row, which is fine.
  const { error: requestError } = await supabase
    .from("promotion_requests")
    .update({ status: "Approved" })
    .eq("candidate_id", userId)
    .eq("target_rank", 3)
    .eq("status", "Pending");
  if (requestError) {
    console.error("SERVER ACTION ERROR [promoteToIntermediate] (promotion_requests):", requestError);
  }

  const memberName = candidate.full_name ?? candidate.username;
  const { error: announceError } = await supabase.from("announcements").insert({
    title: `🎉 ${memberName} is now Intermediate!`,
    content: `${memberName} passed both R1 and R2 challenges and completed the Intro to INT drive, earning promotion from Rookie to Intermediate. Congratulations!`,
    category: "Promotion",
    target_rank: 3,
    published_at: new Date().toISOString(),
  });
  if (announceError) {
    console.error("SERVER ACTION ERROR [promoteToIntermediate] (announcement):", announceError);
  }

  revalidatePath("/promotions-review");
  revalidatePath("/profile");

  return { status: "success", message: `${memberName} promoted to Intermediate.` };
}
