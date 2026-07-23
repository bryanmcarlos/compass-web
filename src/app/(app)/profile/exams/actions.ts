"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { COMPASS_RANKS, SOLO_GPS_DRIVES_REQUIRED } from "@/lib/constants";

export type ExamType =
  | "R1_CATCH_THE_FLAG"
  | "R2_MAZE"
  | "I1_POINT_AND_SHOOT"
  | "I2_NIGHT_RECON"
  | "I3_KING_OF_THE_HILL"
  | "SOLO_GPS_DRIVE";

/** Which rank's curriculum each single-pass challenge belongs to — lets
 * submitExam re-derive the right rank/eligibility gate from the type alone
 * instead of hardcoding rank 2. SOLO_GPS_DRIVE is deliberately absent here
 * — it's repeatable (need 3 passes, not 1), handled by the sibling
 * submitSoloGpsDrive action below instead. */
const SINGLE_PASS_EXAM_RANK: Record<string, 2 | 3> = {
  R1_CATCH_THE_FLAG: 2,
  R2_MAZE: 2,
  I1_POINT_AND_SHOOT: 3,
  I2_NIGHT_RECON: 3,
  I3_KING_OF_THE_HILL: 3,
};

export type SubmitExamState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Shared by submitExam and submitSoloGpsDrive — re-derives approved-drive
 * count and unlocked must-skills for `rank`'s curriculum, server-side,
 * never trusting the client's "locked" UI state. */
async function checkChallengeEligibility(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  rank: 2 | 3,
): Promise<boolean> {
  const curriculum = COMPASS_RANKS[rank];
  const requiredDrives = curriculum.requiredDrives ?? 0;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const regularMustSkills = (curriculum.mustSkills ?? []).filter((s) => s !== gatedSkill);

  const { data: reportRows } = await supabase
    .from("trip_reports")
    .select("drive:drives(must_skills_covered)")
    .eq("author_id", userId)
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
  return meetsDriveCount && meetsMustSkills;
}

/** Driver-facing submission for any single-pass challenge (R1/R2 for
 * Rookies, I1/I2/I3 for Intermediate members) — R1 requires a distinct
 * buddy (the club's actual verification is the driver mentioning that
 * buddy's name in their external challenge post; this just records who
 * they named so a marshal can cross-check it), everything else is solo.
 * Modeled as an append-only log like trip_reports, not an upsert like
 * equipment_verifications — each attempt is a real, discrete event (a
 * post, reviewed, maybe asked to redo), and "current status" for a type is
 * just its most recent row. Rank/eligibility is derived from `examType`
 * itself (SINGLE_PASS_EXAM_RANK), not hardcoded to one rank. */
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

  const requiredRank = SINGLE_PASS_EXAM_RANK[examType];
  if (!requiredRank) {
    return { status: "error", message: "Invalid exam type." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_rank")
    .eq("id", user.id)
    .single();

  if (profile?.current_rank !== requiredRank) {
    return {
      status: "error",
      message: `Only ${requiredRank === 2 ? "Rookies" : "Intermediate members"} can submit this challenge.`,
    };
  }

  // Re-derive eligibility server-side — the client's "locked" state is a
  // UI nicety, this is the real gate. Per the club roadmap, every
  // single-pass challenge unlocks only after all required drives and every
  // regular must-skill are done for that rank.
  const eligible = await checkChallengeEligibility(supabase, user.id, requiredRank);
  if (!eligible) {
    return {
      status: "error",
      message: "Complete your required drives and must-skills before submitting this challenge.",
    };
  }

  const trimmedNotes = notes.trim();
  if (trimmedNotes.length === 0) {
    return { status: "error", message: "Describe your challenge post or attach a link before submitting." };
  }
  if (trimmedNotes.length > 2000) {
    return { status: "error", message: "Submission notes are limited to 2000 characters." };
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

/** The "3 Solo GPS Proficiency Drives" requirement — genuinely different
 * from submitExam's single-pass challenges: each real-world solo drive is
 * its own submission, and up to SOLO_GPS_DRIVES_REQUIRED of them need to
 * pass, not just one. So unlike submitExam, an already-passed history
 * doesn't block a new submission — only a currently-pending one, or
 * already having enough passes, does. */
export async function submitSoloGpsDrive(notes: string): Promise<SubmitExamState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to submit a solo drive." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("current_rank")
    .eq("id", user.id)
    .single();

  if (profile?.current_rank !== 3) {
    return { status: "error", message: "Only Intermediate members can submit solo GPS drives." };
  }

  const eligible = await checkChallengeEligibility(supabase, user.id, 3);
  if (!eligible) {
    return {
      status: "error",
      message: "Complete your required drives and must-skills before submitting a solo drive.",
    };
  }

  const trimmedNotes = notes.trim();
  if (trimmedNotes.length === 0) {
    return {
      status: "error",
      message: "Describe the drive, or link your photo/video and GPX track, before submitting.",
    };
  }
  if (trimmedNotes.length > 2000) {
    return { status: "error", message: "Submission notes are limited to 2000 characters." };
  }

  const { data: existing } = await supabase
    .from("exam_submissions")
    .select("status")
    .eq("user_id", user.id)
    .eq("exam_type", "SOLO_GPS_DRIVE")
    .order("created_at", { ascending: false });

  const passedCount = (existing ?? []).filter((r) => r.status === "passed").length;
  const hasPending = (existing ?? []).some((r) => r.status === "pending");

  if (hasPending) {
    return { status: "error", message: "You already have a solo drive submission awaiting review." };
  }
  if (passedCount >= SOLO_GPS_DRIVES_REQUIRED) {
    return { status: "success", message: "You've already logged all 3 required solo drives." };
  }

  const { error } = await supabase.from("exam_submissions").insert({
    user_id: user.id,
    exam_type: "SOLO_GPS_DRIVE",
    submission_notes: trimmedNotes,
  });

  if (error) {
    console.error("SERVER ACTION ERROR [submitSoloGpsDrive]:", error);
    return { status: "error", message: "Couldn't submit your solo drive. Please try again." };
  }

  revalidatePath("/profile/exams");
  revalidatePath("/promotions-review");

  return { status: "success", message: "Submitted — awaiting marshal review." };
}
