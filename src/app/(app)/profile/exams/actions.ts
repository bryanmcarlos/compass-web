"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { COMPASS_RANKS } from "@/lib/constants";

export type ExamType = "R1_CATCH_THE_FLAG" | "R2_MAZE";

export type SubmitExamState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Driver-facing submission for either Rookie challenge — R1 requires a
 * distinct buddy (the club's actual verification is the driver mentioning
 * that buddy's name in their external challenge post; this just records
 * who they named so a marshal can cross-check it), R2 is solo. Modeled as
 * an append-only log like trip_reports, not an upsert like
 * equipment_verifications — each attempt is a real, discrete event (a
 * post, reviewed, maybe asked to redo), and "current status" for a type is
 * just its most recent row. */
export async function submitExam(
  examType: ExamType,
  notes: string,
  buddyId?: string,
): Promise<SubmitExamState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to submit an exam." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_rank")
    .eq("id", user.id)
    .single();

  if (profile?.current_rank !== 2) {
    return { status: "error", message: "Only Rookies can submit R1/R2 exams." };
  }

  // Re-derive eligibility server-side — the client's "locked" state is a
  // UI nicety, this is the real gate. Per the club roadmap, both R1 and R2
  // unlock only after all 5 required drives and every regular must-skill
  // are done (Intro to INT is deliberately excluded — that drive itself
  // only unlocks after passing these two).
  const curriculum = COMPASS_RANKS[2];
  const requiredDrives = curriculum.requiredDrives ?? 0;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const regularMustSkills = (curriculum.mustSkills ?? []).filter((s) => s !== gatedSkill);

  const { data: reportRows } = await supabase
    .from("trip_reports")
    .select("drive:drives(must_skills_covered)")
    .eq("author_id", user.id)
    .eq("is_approved", true)
    .overrideTypes<{ drive: { must_skills_covered: string[] | null } | null }[], { merge: false }>();

  const unlockedSkills = new Set<string>();
  for (const row of reportRows ?? []) {
    for (const skill of row.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }
  const meetsDriveCount = (reportRows?.length ?? 0) >= requiredDrives;
  const meetsMustSkills = regularMustSkills.every((s) => unlockedSkills.has(s));

  if (!meetsDriveCount || !meetsMustSkills) {
    return {
      status: "error",
      message: "Complete your 5 required drives and must-skills before submitting this challenge.",
    };
  }

  const trimmedNotes = notes.trim();
  if (trimmedNotes.length === 0) {
    return { status: "error", message: "Describe your challenge post or attach a link before submitting." };
  }
  if (trimmedNotes.length > 2000) {
    return { status: "error", message: "Submission notes are limited to 2000 characters." };
  }

  if (examType !== "R1_CATCH_THE_FLAG" && examType !== "R2_MAZE") {
    return { status: "error", message: "Invalid exam type." };
  }

  let resolvedBuddyId: string | null = null;
  if (examType === "R1_CATCH_THE_FLAG") {
    if (!buddyId || buddyId === user.id) {
      return { status: "error", message: "R1 requires naming a buddy other than yourself." };
    }
    const { data: buddyProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", buddyId)
      .maybeSingle();
    if (!buddyProfile) {
      return { status: "error", message: "Couldn't find that buddy — pick a member from the list." };
    }
    resolvedBuddyId = buddyId;
  }

  const { data: latestSubmission } = await supabase
    .from("exam_submissions")
    .select("status")
    .eq("user_id", user.id)
    .eq("exam_type", examType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSubmission?.status === "pending") {
    return { status: "error", message: "You already have a submission awaiting review." };
  }
  if (latestSubmission?.status === "passed") {
    return { status: "success", message: "You've already passed this exam." };
  }

  const { error } = await supabase.from("exam_submissions").insert({
    user_id: user.id,
    exam_type: examType,
    submission_notes: trimmedNotes,
    buddy_id: resolvedBuddyId,
  });

  if (error) {
    console.error("SERVER ACTION ERROR [submitExam]:", error);
    return { status: "error", message: "Couldn't submit your exam. Please try again." };
  }

  revalidatePath("/profile/exams");
  revalidatePath("/promotions-review");

  return { status: "success", message: "Submitted — awaiting marshal review." };
}
