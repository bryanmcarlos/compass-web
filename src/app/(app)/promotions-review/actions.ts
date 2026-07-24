"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { COMPASS_RANKS, rankNameFromLevel } from "@/lib/constants";

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

/** R1/R2-specific: a pending challenge submission isn't graded directly —
 * it's accepted into a real exam drive a Marshal has already created (or is
 * about to run), which is what the drive is actually for. This flips the
 * selected submissions to "accepted" and auto-registers each submitter onto
 * that drive, so nobody has to separately remember to register the people
 * they just accepted.
 *
 * Deliberately does NOT also register the buddy named on an R1 submission —
 * that name is just who a member claims to have posted the challenge with,
 * not their real exam-day pairing. Real pairs are shuffled at the drive
 * itself, so if a buddy also needs to attend, their own submission should
 * be selected and accepted too, same as anyone else's. */
export async function acceptExamSubmissions(
  submissionIds: string[],
  driveId: string,
): Promise<PromotionsReviewActionState> {
  const supabase = await createClient();
  const { user, error: authError } = await requireReviewer(supabase);
  if (authError || !user) {
    return { status: "error", message: authError };
  }

  if (submissionIds.length === 0) {
    return { status: "error", message: "Select at least one submission to accept." };
  }

  const { data: submissions } = await supabase
    .from("exam_submissions")
    .select("id, user_id, status")
    .in("id", submissionIds);

  if (!submissions || submissions.length === 0) {
    return { status: "error", message: "Couldn't find those submissions." };
  }
  if (submissions.some((s) => s.status !== "pending")) {
    return { status: "error", message: "Only pending submissions can be accepted." };
  }

  const { error: updateError } = await supabase
    .from("exam_submissions")
    .update({ status: "accepted", exam_drive_id: driveId })
    .in("id", submissionIds);

  if (updateError) {
    console.error("SERVER ACTION ERROR [acceptExamSubmissions]:", updateError);
    return { status: "error", message: "Couldn't accept those submissions. Please try again." };
  }

  const memberIds = new Set(submissions.map((s) => s.user_id));

  const { data: memberProfiles } = await supabase
    .from("profiles")
    .select("id, current_rank")
    .in("id", Array.from(memberIds));

  const rows = (memberProfiles ?? []).map((p) => ({
    drive_id: driveId,
    user_id: p.id,
    role: "Driver" as const,
    disclaimer_accepted: true,
    driver_rank: rankNameFromLevel(p.current_rank),
  }));

  const { error: registerError } = await supabase
    .from("drive_registrations")
    .upsert(rows, { onConflict: "drive_id,user_id", ignoreDuplicates: true });

  revalidatePath("/promotions-review");
  revalidatePath(`/drives/${driveId}`);
  revalidatePath("/profile/exams");

  if (registerError) {
    console.error("SERVER ACTION ERROR [acceptExamSubmissions register]:", registerError);
    return {
      status: "success",
      message: "Accepted, but couldn't auto-register everyone — register them manually on the drive.",
    };
  }

  return {
    status: "success",
    message: `Accepted ${submissions.length} submission(s) and registered everyone onto the exam drive.`,
  };
}

/** Grades an accepted R1/R2 submission (or a buddy pair, both IDs passed
 * together) once its exam drive has actually happened — separate from
 * gradeExam, which still directly grades I1/I2/I3/solo-GPS submissions that
 * don't go through the exam-drive flow. Only reachable once the linked
 * drive is Completed, so a Marshal can't grade an exam that hasn't
 * happened yet. */
export async function gradeExamDriveSubmissions(
  submissionIds: string[],
  status: "passed" | "failed",
): Promise<PromotionsReviewActionState> {
  const supabase = await createClient();
  const { user, error: authError } = await requireReviewer(supabase);
  if (authError || !user) {
    return { status: "error", message: authError };
  }

  if (submissionIds.length === 0) {
    return { status: "error", message: "No submission selected." };
  }

  const { data: submissions } = await supabase
    .from("exam_submissions")
    .select("id, exam_drive_id, status")
    .in("id", submissionIds);

  if (!submissions || submissions.length === 0) {
    return { status: "error", message: "Couldn't find that submission." };
  }

  const driveId = submissions[0].exam_drive_id;
  if (!driveId || submissions.some((s) => s.exam_drive_id !== driveId)) {
    return { status: "error", message: "Those submissions aren't linked to the same exam drive." };
  }
  if (submissions.some((s) => s.status !== "accepted")) {
    return { status: "error", message: "Only accepted submissions awaiting grading can be graded here." };
  }

  const { data: drive } = await supabase.from("drives").select("status").eq("id", driveId).single();
  if (drive?.status !== "Completed") {
    return { status: "error", message: "This exam drive hasn't been marked Completed yet." };
  }

  const { error } = await supabase
    .from("exam_submissions")
    .update({ status, graded_by: user.id, graded_at: new Date().toISOString() })
    .in("id", submissionIds);

  if (error) {
    console.error("SERVER ACTION ERROR [gradeExamDriveSubmissions]:", error);
    return { status: "error", message: "Couldn't grade that submission. Please try again." };
  }

  revalidatePath(`/drives/${driveId}`);
  revalidatePath("/promotions-review");
  revalidatePath("/profile/exams");

  return {
    status: "success",
    message: status === "passed" ? "Marked as passed." : "Marked as failed.",
  };
}

/** Re-derives and re-verifies every promotion criterion server-side rather
 * than trusting the "Ready for Rookie" list the button was clicked from —
 * same reasoning as promoteToIntermediate below. Unlike Rookie -> Intermediate,
 * this stage has no exam — must-skills (incl. the gated "Intro to ROK" drive)
 * and equipment verification are the whole bar. */
export async function promoteToRookie(userId: string): Promise<PromotionsReviewActionState> {
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

  if (!candidate || candidate.current_rank !== 1) {
    return { status: "error", message: "This member isn't currently a Newbie." };
  }

  const curriculum = COMPASS_RANKS[1];
  const requiredCount = curriculum.requiredDrives ?? 0;
  const gatedSkill = curriculum.gatedFinalMustSkill;
  const requiredMustSkills = (curriculum.mustSkills ?? []).filter((s) => s !== gatedSkill);
  const requiredEquipmentCount = curriculum.toolsRequired?.length ?? 0;

  const [{ count: approvedCount }, { data: reportRows }, { count: verifiedEquipmentCount }] =
    await Promise.all([
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
        .from("equipment_verifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "verified"),
    ]);

  const unlockedSkills = new Set<string>();
  for (const report of reportRows ?? []) {
    for (const skill of report.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }

  const meetsDriveCount = (approvedCount ?? 0) >= requiredCount;
  const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
  const meetsIntroToRok = !gatedSkill || unlockedSkills.has(gatedSkill);
  const meetsEquipment = (verifiedEquipmentCount ?? 0) >= requiredEquipmentCount;

  if (!meetsDriveCount || !meetsMustSkills || !meetsIntroToRok || !meetsEquipment) {
    return {
      status: "error",
      message: "This member no longer meets every promotion requirement — refresh and check again.",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ current_rank: 2 })
    .eq("id", userId);

  if (updateError) {
    console.error("SERVER ACTION ERROR [promoteToRookie]:", updateError);
    return { status: "error", message: "Couldn't finalize this promotion. Please try again." };
  }

  // Best-effort — a Newbie who never clicked the promotion-request button
  // simply has no matching row, which is fine (see /profile — readiness is
  // computed live here, the request row is just a courtesy signal).
  const { error: requestError } = await supabase
    .from("promotion_requests")
    .update({ status: "Approved" })
    .eq("candidate_id", userId)
    .eq("target_rank", 2)
    .eq("status", "Pending");
  if (requestError) {
    console.error("SERVER ACTION ERROR [promoteToRookie] (promotion_requests):", requestError);
  }

  const memberName = candidate.full_name ?? candidate.username;
  const { error: announceError } = await supabase.from("announcements").insert({
    title: `🎉 ${memberName} is now a Rookie!`,
    content: `${memberName} completed all Newbie must-skills (including Intro to ROK), 5 drives, and equipment verification, earning promotion from Newbie to Rookie. Congratulations!`,
    category: "Promotion",
    target_rank: 2,
    published_at: new Date().toISOString(),
  });
  if (announceError) {
    console.error("SERVER ACTION ERROR [promoteToRookie] (announcement):", announceError);
  }

  revalidatePath("/promotions-review");
  revalidatePath("/profile");

  return { status: "success", message: `${memberName} promoted to Rookie.` };
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
      .select("drive_id, drive:drives(must_skills_covered)")
      .eq("author_id", userId)
      .eq("is_approved", true)
      .overrideTypes<
        { drive_id: string | null; drive: { must_skills_covered: string[] | null } | null }[],
        { merge: false }
      >(),
    supabase
      .from("exam_submissions")
      .select("exam_type, status, exam_drive_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .overrideTypes<
        {
          exam_type: "R1_CATCH_THE_FLAG" | "R2_MAZE";
          status: string;
          exam_drive_id: string | null;
          created_at: string;
        }[],
        { merge: false }
      >(),
  ]);

  const unlockedSkills = new Set<string>();
  const reportedDriveIds = new Set<string>();
  for (const report of reportRows ?? []) {
    for (const skill of report.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
    if (report.drive_id) reportedDriveIds.add(report.drive_id);
  }

  const latestExamByType = new Map<string, { status: string; examDriveId: string | null }>();
  for (const row of examRows ?? []) {
    if (!latestExamByType.has(row.exam_type)) {
      latestExamByType.set(row.exam_type, { status: row.status, examDriveId: row.exam_drive_id });
    }
  }
  const r1 = latestExamByType.get("R1_CATCH_THE_FLAG");
  const r2 = latestExamByType.get("R2_MAZE");

  const meetsDriveCount = (approvedCount ?? 0) >= requiredCount;
  const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
  // Passed alone isn't enough for either — each also needs its own approved
  // trip report for its exam drive, matching the real club process (pass
  // the exam, then file the report for it).
  const meetsExams =
    r1?.status === "passed" &&
    Boolean(r1.examDriveId && reportedDriveIds.has(r1.examDriveId)) &&
    r2?.status === "passed" &&
    Boolean(r2.examDriveId && reportedDriveIds.has(r2.examDriveId));
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

const REQUIRED_SOLO_GPS_DRIVES = 3;
const REQUIRED_LEAD_DRIVES = 3;

/** Re-derives and re-verifies every promotion criterion server-side rather
 * than trusting the "Ready for Advanced" list the button was clicked from
 * — same reasoning as promoteToIntermediate above. No gated final
 * must-skill for this stage (COMPASS_RANKS[3] doesn't define one), so
 * unlike Newbie/Rookie there's no separate "waiting on one more drive"
 * case here. */
export async function promoteToAdvanced(userId: string): Promise<PromotionsReviewActionState> {
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

  if (!candidate || candidate.current_rank !== 3) {
    return { status: "error", message: "This member isn't currently Intermediate." };
  }

  const curriculum = COMPASS_RANKS[3];
  const requiredCount = curriculum.requiredDrives ?? 0;
  const requiredMustSkills = curriculum.mustSkills ?? [];

  const [{ count: approvedCount }, { data: reportRows }, { data: examRows }, { count: leadDriveCount }] =
    await Promise.all([
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
        .overrideTypes<{ exam_type: string; status: string; created_at: string }[], { merge: false }>(),
      supabase
        .from("drive_registrations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("role", "Lead"),
    ]);

  const unlockedSkills = new Set<string>();
  for (const report of reportRows ?? []) {
    for (const skill of report.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }

  const latestSingleExamStatus = new Map<string, string>();
  let soloGpsPassedCount = 0;
  for (const row of examRows ?? []) {
    if (row.exam_type === "SOLO_GPS_DRIVE") {
      if (row.status === "passed") soloGpsPassedCount++;
      continue;
    }
    if (!latestSingleExamStatus.has(row.exam_type)) {
      latestSingleExamStatus.set(row.exam_type, row.status);
    }
  }

  const meetsDriveCount = (approvedCount ?? 0) >= requiredCount;
  const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));
  const meetsChallenges =
    latestSingleExamStatus.get("I1_POINT_AND_SHOOT") === "passed" &&
    latestSingleExamStatus.get("I2_NIGHT_RECON") === "passed" &&
    latestSingleExamStatus.get("I3_KING_OF_THE_HILL") === "passed";
  const meetsSoloGps = soloGpsPassedCount >= REQUIRED_SOLO_GPS_DRIVES;
  const meetsLeadDrives = (leadDriveCount ?? 0) >= REQUIRED_LEAD_DRIVES;

  if (!meetsDriveCount || !meetsMustSkills || !meetsChallenges || !meetsSoloGps || !meetsLeadDrives) {
    return {
      status: "error",
      message: "This member no longer meets every promotion requirement — refresh and check again.",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ current_rank: 4 })
    .eq("id", userId);

  if (updateError) {
    console.error("SERVER ACTION ERROR [promoteToAdvanced]:", updateError);
    return { status: "error", message: "Couldn't finalize this promotion. Please try again." };
  }

  const { error: requestError } = await supabase
    .from("promotion_requests")
    .update({ status: "Approved" })
    .eq("candidate_id", userId)
    .eq("target_rank", 4)
    .eq("status", "Pending");
  if (requestError) {
    console.error("SERVER ACTION ERROR [promoteToAdvanced] (promotion_requests):", requestError);
  }

  const memberName = candidate.full_name ?? candidate.username;
  const { error: announceError } = await supabase.from("announcements").insert({
    title: `🎉 ${memberName} is now Advanced!`,
    content: `${memberName} passed I1, I2, and I3, logged 3 solo GPS drives, and led 3 drives, earning promotion from Intermediate to Advanced. Congratulations!`,
    category: "Promotion",
    target_rank: 4,
    published_at: new Date().toISOString(),
  });
  if (announceError) {
    console.error("SERVER ACTION ERROR [promoteToAdvanced] (announcement):", announceError);
  }

  revalidatePath("/promotions-review");
  revalidatePath("/profile");

  return { status: "success", message: `${memberName} promoted to Advanced.` };
}

export type MarshalshipAttestationField =
  | "marshalship_training_endorsed"
  | "marshalship_vote_passed"
  | "marshalship_final_assessment_passed";

const VALID_ATTESTATION_FIELDS: MarshalshipAttestationField[] = [
  "marshalship_training_endorsed",
  "marshalship_vote_passed",
  "marshalship_final_assessment_passed",
];

/** A Marshal/Admin's own record that a real-world governance step happened
 * — Marshalship Training endorsement, the Marshals Vote, the final
 * Marshalship NWB Drive assessment. The app has no way to observe any of
 * these; this is deliberately just an attestation, not something inferred
 * from other data. */
export async function setMarshalshipAttestation(
  userId: string,
  field: MarshalshipAttestationField,
  value: boolean,
): Promise<PromotionsReviewActionState> {
  const supabase = await createClient();
  const { error: authError } = await requireReviewer(supabase);
  if (authError) {
    return { status: "error", message: authError };
  }

  if (!VALID_ATTESTATION_FIELDS.includes(field)) {
    return { status: "error", message: "Invalid attestation field." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ [field]: value })
    .eq("id", userId);

  if (error) {
    console.error("SERVER ACTION ERROR [setMarshalshipAttestation]:", error);
    return { status: "error", message: "Couldn't save that. Please try again." };
  }

  revalidatePath("/promotions-review");

  return { status: "success", message: "Saved." };
}

/** Re-derives and re-verifies server-side, same as every other promotion
 * action — but this is the one stage where the criteria are partly
 * subjective attestations rather than fully objective data. The objective
 * part (supervised leads + must-skills) is re-checked the same way as
 * every other rank; the 3 attestation booleans are re-read fresh from
 * `profiles` rather than trusted from whatever the client last rendered,
 * so a checkbox someone unchecked a second before this was clicked can't
 * slip through. */
export async function promoteToMarshal(userId: string): Promise<PromotionsReviewActionState> {
  const supabase = await createClient();
  const { error: authError } = await requireReviewer(supabase);
  if (authError) {
    return { status: "error", message: authError };
  }

  const { data: candidate } = await supabase
    .from("profiles")
    .select(
      "current_rank, username, full_name, marshalship_training_endorsed, marshalship_vote_passed, marshalship_final_assessment_passed",
    )
    .eq("id", userId)
    .single();

  if (!candidate || candidate.current_rank !== 4) {
    return { status: "error", message: "This member isn't currently Advanced." };
  }

  if (
    !candidate.marshalship_training_endorsed ||
    !candidate.marshalship_vote_passed ||
    !candidate.marshalship_final_assessment_passed
  ) {
    return {
      status: "error",
      message: "All 3 marshalship attestations must be checked before finalizing.",
    };
  }

  const curriculum = COMPASS_RANKS[4];
  const requiredCount = curriculum.requiredSupervisedLeads ?? 0;
  const requiredMustSkills = curriculum.mustSkills ?? [];

  const [{ count: approvedCount }, { data: reportRows }] = await Promise.all([
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
  ]);

  const unlockedSkills = new Set<string>();
  for (const report of reportRows ?? []) {
    for (const skill of report.drive?.must_skills_covered ?? []) {
      unlockedSkills.add(skill);
    }
  }

  const meetsDriveCount = (approvedCount ?? 0) >= requiredCount;
  const meetsMustSkills = requiredMustSkills.every((s) => unlockedSkills.has(s));

  if (!meetsDriveCount || !meetsMustSkills) {
    return {
      status: "error",
      message: "This member no longer meets every promotion requirement — refresh and check again.",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ current_rank: 5 })
    .eq("id", userId);

  if (updateError) {
    console.error("SERVER ACTION ERROR [promoteToMarshal]:", updateError);
    return { status: "error", message: "Couldn't finalize this promotion. Please try again." };
  }

  const { error: requestError } = await supabase
    .from("promotion_requests")
    .update({ status: "Approved" })
    .eq("candidate_id", userId)
    .eq("target_rank", 5)
    .eq("status", "Pending");
  if (requestError) {
    console.error("SERVER ACTION ERROR [promoteToMarshal] (promotion_requests):", requestError);
  }

  const memberName = candidate.full_name ?? candidate.username;
  const { error: announceError } = await supabase.from("announcements").insert({
    title: `🎉 ${memberName} is now a Marshal!`,
    content: `${memberName} completed Marshalship Training, passed the Marshals Vote, and cleared the final Marshalship NWB Drive assessment, earning promotion from Advanced to Marshal. Congratulations!`,
    category: "Promotion",
    target_rank: 5,
    published_at: new Date().toISOString(),
  });
  if (announceError) {
    console.error("SERVER ACTION ERROR [promoteToMarshal] (announcement):", announceError);
  }

  revalidatePath("/promotions-review");
  revalidatePath("/profile");

  return { status: "success", message: `${memberName} promoted to Marshal.` };
}
