"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { COMPASS_RANKS } from "@/lib/constants";
import { applyDriveTitlePrefix } from "@/lib/driveTitle";
import { validateImageFile } from "@/lib/imageUpload";
import type { ToggleReactionState } from "@/components/club/LikeButton";

export type DriveFormState = {
  status: "idle" | "error" | "success";
  message: string | null;
  /** Set on a successful updateDrive so the client can re-sync its display
   * from what the server actually confirmed as saved, rather than assuming
   * its own pre-submit state is still an accurate mirror of the database. */
  updatedFields?: {
    title: string;
    meeting_time: string | null;
    drive_start_time: string | null;
    drive_end_time: string | null;
    banner_url: string | null;
  } | null;
};

const STATUSES = ["Scheduled", "Completed", "Cancelled"];
const CAMP_SCHEDULE_TYPES = ["Before the Drive", "After the Drive"];
// Matches exam_submissions.exam_type's own check constraint (minus
// SOLO_GPS_DRIVE, which isn't a single-pass challenge with its own exam
// drive) — flags a drive as the specific R1/R2/I1/I2/I3 exam event a
// Marshal accepted challenge submissions into, so promotions-review's
// accept flow can offer only drives actually meant for that exam.
const EXAM_TYPES = [
  "R1_CATCH_THE_FLAG",
  "R2_MAZE",
  "I1_POINT_AND_SHOOT",
  "I2_NIGHT_RECON",
  "I3_KING_OF_THE_HILL",
];

// Accepts the native <input type="time"> formats Postgres TIME columns also
// accept natively: "HH:MM" and "HH:MM:SS" (24-hour).
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

/** Empty -> null. Otherwise must match TIME_PATTERN, or this fails. */
function parseOptionalTime(raw: string): string | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return TIME_PATTERN.test(trimmed) ? trimmed : "invalid";
}

/** Empty -> null. Missing scheme gets `https://` prepended (mobile share
 * links like "maps.app.goo.gl/..." omit it) before a light validity check —
 * any resulting absolute URL is accepted, not just known Google domains, so
 * a Waze/OSM link etc. still works. Otherwise this fails. */
function parseOptionalMapUrl(raw: string): string | null | "invalid" {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    new URL(withScheme);
    return withScheme;
  } catch {
    return "invalid";
  }
}

async function requireMarshal() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, isMarshal: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_marshal")
    .eq("id", user.id)
    .single();

  return { supabase, user, isMarshal: profile?.is_marshal ?? false };
}

type BannerUploadResult = { ok: true; url: string } | { ok: false; message: string };

/** Uploads to the 'drive-banners' bucket and returns its public URL. Storage
 * RLS still gates this independently (marshals only) — this is the same
 * user-scoped client `requireMarshal()` returned, never a service-role
 * client, so a client-side bypass of the isMarshal check above still can't
 * write to storage. */
async function uploadBannerImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  file: File,
): Promise<BannerUploadResult> {
  const { error } = await supabase.storage
    .from("drive-banners")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("SERVER ACTION ERROR [drive banner upload]:", error);
    return { ok: false, message: "Couldn't upload the banner image. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("drive-banners").getPublicUrl(path);

  // Cache-busted so <img> tags pick up a replaced file immediately even
  // though an upsert overwrite leaves the storage path unchanged.
  return { ok: true, url: `${publicUrl}?v=${Date.now()}` };
}

type ParsedDriveFields =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; message: string };

/** Shared validation for both create and update — never trust the client's
 * enum values, numeric ranges, or which skills are valid for the chosen rank. */
function parseDriveFields(formData: FormData): ParsedDriveFields {
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const driveDate = String(formData.get("driveDate") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const maxDrivers = Number(formData.get("maxDrivers"));

  // isAllLevels forces the full 1-5 set server-side regardless of what
  // checkboxes were actually submitted — defense-in-depth, matching this
  // function's existing "never trust the client's enum values" posture.
  const isAllLevels = formData.get("isAllLevels") === "on";
  const submittedRanks = formData
    .getAll("allowedRanks")
    .map((v) => Number(v))
    .filter((r) => Number.isInteger(r) && r >= 1 && r <= 5);
  const allowedRanks = isAllLevels ? [1, 2, 3, 4, 5] : [...new Set(submittedRanks)];

  if (!title || !driveDate || !location) {
    return { ok: false, message: "Fill in the title, date, and location." };
  }
  if (!STATUSES.includes(status)) {
    return { ok: false, message: "Choose a valid status." };
  }
  if (allowedRanks.length === 0) {
    return { ok: false, message: "Choose at least one rank, or mark this drive All Levels." };
  }
  if (!Number.isInteger(maxDrivers) || maxDrivers < 1) {
    return { ok: false, message: "Max driver slots must be a positive number." };
  }

  // target_rank is derived, not client-trusted — the minimum of the
  // selected ranks, kept in sync for the title-prefix and any other code
  // still reading a single rank number.
  const targetRank = Math.min(...allowedRanks);

  // Union across every selected rank's curriculum — a multi-rank drive can
  // check off must-skills from any of its covered ranks, not just the
  // minimum's.
  const allowedSkills = new Set(
    allowedRanks.flatMap((r) => COMPASS_RANKS[r as 1 | 2 | 3 | 4 | 5]?.mustSkills ?? []),
  );
  const mustSkills = formData
    .getAll("mustSkills")
    .map((v) => String(v))
    // Only accept skills that actually belong to one of the submitted
    // ranks' curricula — a crafted POST could otherwise inject arbitrary
    // strings.
    .filter((skill) => allowedSkills.has(skill));

  const examTypeRaw = String(formData.get("examType") ?? "").trim();
  if (examTypeRaw && !EXAM_TYPES.includes(examTypeRaw)) {
    return { ok: false, message: "Invalid exam type." };
  }
  const examType = examTypeRaw || null;

  const equipmentRequirements = [
    ...new Set(
      formData
        .getAll("equipmentRequirements")
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  ];

  const optionalText = (key: string) => {
    const value = String(formData.get(key) ?? "").trim();
    return value || null;
  };

  const mapUrl = parseOptionalMapUrl(String(formData.get("mapUrl") ?? ""));
  if (mapUrl === "invalid") {
    return { ok: false, message: "Enter a valid map link." };
  }
  const exitLocationMapUrl = parseOptionalMapUrl(
    String(formData.get("exitLocationMapUrl") ?? ""),
  );
  if (exitLocationMapUrl === "invalid") {
    return { ok: false, message: "Enter a valid map link for the exit location." };
  }
  const nearestPetrolStationMapUrl = parseOptionalMapUrl(
    String(formData.get("nearestPetrolStationMapUrl") ?? ""),
  );
  if (nearestPetrolStationMapUrl === "invalid") {
    return { ok: false, message: "Enter a valid map link for the nearest petrol station." };
  }

  const meetingTime = parseOptionalTime(String(formData.get("meetingTime") ?? ""));
  if (meetingTime === "invalid") {
    return { ok: false, message: "Meeting time must be a valid 24-hour time." };
  }
  const driveStartTime = parseOptionalTime(
    String(formData.get("driveStartTime") ?? ""),
  );
  if (driveStartTime === "invalid") {
    return { ok: false, message: "Start time must be a valid 24-hour time." };
  }
  const driveEndTime = parseOptionalTime(String(formData.get("driveEndTime") ?? ""));
  if (driveEndTime === "invalid") {
    return { ok: false, message: "End time must be a valid 24-hour time." };
  }

  const hasCamp = formData.get("hasCamp") === "on";
  let campDate: string | null = null;
  let campTime: string | null = null;
  let campLocation: string | null = null;
  let campCoordinates: string | null = null;
  let campScheduleType: string | null = null;

  if (hasCamp) {
    campDate = String(formData.get("campDate") ?? "").trim();
    campLocation = optionalText("campLocation");
    campCoordinates = optionalText("campCoordinates");
    campScheduleType = String(formData.get("campScheduleType") ?? "");

    if (!campDate || !campLocation) {
      return {
        ok: false,
        message: "Fill in the camping date and location, or turn camping off.",
      };
    }
    if (!CAMP_SCHEDULE_TYPES.includes(campScheduleType)) {
      return { ok: false, message: "Choose a valid camping schedule." };
    }

    const parsedCampTime = parseOptionalTime(String(formData.get("campTime") ?? ""));
    if (parsedCampTime === "invalid") {
      return { ok: false, message: "Camping time must be a valid 24-hour time." };
    }
    campTime = parsedCampTime;
  }

  return {
    ok: true,
    fields: {
      // drive_id_code is intentionally omitted — a database trigger
      // generates it on insert, and it's left untouched on update.
      // Strips any existing rank prefix before reapplying the correct one,
      // so this is safe whether `title` is a clean base title (the normal
      // case, since the form field never shows the prefix) or one that
      // still carries a stale prefix from before the target rank changed.
      title: applyDriveTitlePrefix(title, targetRank, isAllLevels),
      // Difficulty is no longer collected from the form or shown anywhere
      // on the frontend — the column stays (still NOT NULL), so every
      // insert/update just writes a fixed, unused value rather than making
      // this a schema change.
      difficulty: "Moderate",
      status,
      drive_date: driveDate,
      location,
      target_rank: targetRank,
      allowed_ranks: allowedRanks.map(String),
      is_all_levels: isAllLevels,
      max_drivers: maxDrivers,
      meeting_point_name: optionalText("meetingPointName"),
      coordinates: optionalText("coordinates"),
      exit_location: optionalText("exitLocation"),
      exit_location_map_url: exitLocationMapUrl,
      nearest_petrol_station: optionalText("nearestPetrolStation"),
      nearest_petrol_station_map_url: nearestPetrolStationMapUrl,
      map_url: mapUrl,
      meeting_time: meetingTime,
      drive_start_time: driveStartTime,
      drive_end_time: driveEndTime,
      radio_frequency: optionalText("radioFrequency"),
      equipment_requirements:
        equipmentRequirements.length > 0 ? equipmentRequirements : null,
      must_skills_covered: mustSkills.length > 0 ? mustSkills : null,
      exam_type: examType,
      // Toggling camping off clears any previously-saved camp details rather
      // than leaving stale data behind that the UI no longer shows as set.
      has_camp: hasCamp,
      camp_date: campDate,
      camp_time: campTime,
      camp_location: campLocation,
      camp_coordinates: campCoordinates,
      camp_schedule_type: campScheduleType,
    },
  };
}

export async function createDrive(
  _prevState: DriveFormState,
  formData: FormData,
): Promise<DriveFormState> {
  const { supabase, user, isMarshal } = await requireMarshal();

  if (!user) {
    return { status: "error", message: "You need to be signed in to post a drive." };
  }
  if (!isMarshal) {
    return { status: "error", message: "Only marshals can post drives." };
  }

  const parsed = parseDriveFields(formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  const fields = { ...parsed.fields };

  // No drive id exists yet to path by, so a fresh random path is used
  // instead — unlike the edit-mode path below, there's nothing to overwrite.
  const bannerEntry = formData.get("bannerImage");
  if (bannerEntry instanceof File && bannerEntry.size > 0) {
    const validation = validateImageFile(bannerEntry);
    if (!validation.ok) {
      return { status: "error", message: validation.message };
    }
    const extension = validation.file.type.split("/")[1] ?? "jpg";
    const path = `${user.id}/${randomUUID()}.${extension}`;
    const uploaded = await uploadBannerImage(supabase, path, validation.file);
    if (!uploaded.ok) {
      return { status: "error", message: uploaded.message };
    }
    fields.banner_url = uploaded.url;
  }

  let newDriveId: string;

  try {
    // drive_id_code is generated by a DB trigger on insert, not by this app
    // — a collision here means the trigger computed a code that already
    // exists (most likely two near-simultaneous creates racing each other).
    // Retrying the same insert re-triggers fresh code generation, so this
    // is a real fix for that race, not just a swallowed error — capped at 3
    // attempts so a *genuinely* broken trigger still fails loudly instead
    // of hanging.
    const MAX_ATTEMPTS = 3;
    let lastError: { code?: string; message: string } | null = null;
    let insertedId: string | null = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { data, error } = await supabase
        .from("drives")
        .insert({ ...fields, lead_marshal_id: user.id })
        .select("id")
        .single();

      if (!error) {
        insertedId = data.id;
        break;
      }

      lastError = error;
      const isDriveIdCodeCollision =
        error.code === "23505" && error.message.includes("drives_drive_id_code_key");
      if (!isDriveIdCodeCollision) {
        break;
      }
      console.error(
        `SERVER ACTION [createDrive]: drive_id_code collision, attempt ${attempt}/${MAX_ATTEMPTS}`,
        error,
      );
    }

    if (!insertedId) {
      console.error("SERVER ACTION ERROR [createDrive]:", lastError);
      return {
        status: "error",
        message: lastError?.message ?? "Couldn't post this drive. Please try again.",
      };
    }

    newDriveId = insertedId;
  } catch (err) {
    console.error("SERVER ACTION ERROR [createDrive]:", err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Couldn't post this drive. Please try again.",
    };
  }

  // lead_marshal_id is always the creating marshal (set above) — auto-seat
  // them as the drive's own "Lead" registration so the roster never shows
  // an empty Lead slot under a card that already says "Led by <them>".
  // disclaimer_accepted: true is safe unconditionally here (unlike the
  // admin-assigns-someone-else path in assignActions.ts, which requires an
  // explicit attestation checkbox) — the actor and the subject are the same
  // person, so this is just a self-registration side effect of creating the
  // drive, not a consent record being recorded on someone else's behalf.
  // Best-effort: the drive itself already saved successfully by this point,
  // so a failure here shouldn't block the redirect or be reported as if the
  // whole action failed.
  const { error: leadRegistrationError } = await supabase.from("drive_registrations").insert({
    drive_id: newDriveId,
    user_id: user.id,
    role: "Lead",
    disclaimer_accepted: true,
  });
  if (leadRegistrationError) {
    console.error(
      "Failed to auto-register lead marshal for new drive:",
      leadRegistrationError,
    );
  }

  // redirect() throws a framework-handled control-flow exception — it must
  // stay outside the try/catch above, or it would be caught and reported as
  // a real error instead of performing the navigation.
  revalidatePath("/drives");
  redirect(`/drives/${newDriveId}`);
}

export async function updateDrive(
  _prevState: DriveFormState,
  formData: FormData,
): Promise<DriveFormState> {
  const { supabase, user, isMarshal } = await requireMarshal();

  if (!user) {
    return { status: "error", message: "You need to be signed in to edit a drive." };
  }
  if (!isMarshal) {
    return { status: "error", message: "Only marshals can edit drives." };
  }

  const driveId = String(formData.get("driveId") ?? "").trim();
  if (!driveId) {
    return { status: "error", message: "Missing drive." };
  }

  const parsed = parseDriveFields(formData);
  if (!parsed.ok) {
    return { status: "error", message: parsed.message };
  }

  const fields = { ...parsed.fields };

  // A fixed per-drive path (rather than a random one) keeps storage tidy via
  // upsert — a replaced banner overwrites the last one instead of
  // accumulating orphaned files. `removeBanner` explicitly nulls the column
  // out; leaving both unset (no new file, no removal) leaves it untouched by
  // simply never adding the key to `fields`, so the existing value survives.
  const bannerEntry = formData.get("bannerImage");
  const removeBanner = formData.get("removeBanner") === "on";
  if (bannerEntry instanceof File && bannerEntry.size > 0) {
    const validation = validateImageFile(bannerEntry);
    if (!validation.ok) {
      return { status: "error", message: validation.message };
    }
    const extension = validation.file.type.split("/")[1] ?? "jpg";
    const path = `${driveId}/banner.${extension}`;
    const uploaded = await uploadBannerImage(supabase, path, validation.file);
    if (!uploaded.ok) {
      return { status: "error", message: uploaded.message };
    }
    fields.banner_url = uploaded.url;
  } else if (removeBanner) {
    fields.banner_url = null;
  }

  try {
    // Exactly what's about to be sent to Postgres for these three columns —
    // check this against the terminal if a save ever looks like it didn't
    // take, before suspecting anything further upstream.
    console.log("DB UPDATE PAYLOAD:", {
      meeting_time: parsed.fields.meeting_time,
      drive_start_time: parsed.fields.drive_start_time,
      drive_end_time: parsed.fields.drive_end_time,
    });

    // Deliberately not gated on drive.status — marshals can still update
    // must_skills_covered (and anything else) after a drive is Completed.
    // .select().single() reads back exactly what Postgres now holds, so the
    // caller can re-sync the form from confirmed reality instead of assuming
    // its pre-submit client state is still accurate.
    const { data: updatedDrive, error } = await supabase
      .from("drives")
      .update(fields)
      .eq("id", driveId)
      .select("title, meeting_time, drive_start_time, drive_end_time, banner_url")
      .single();

    if (error) {
      console.error("SERVER ACTION ERROR [updateDrive]:", error);
      return { status: "error", message: error.message };
    }

    revalidatePath(`/drives/${driveId}`);
    revalidatePath("/drives");

    return {
      status: "success",
      message: "Drive updated.",
      updatedFields: updatedDrive,
    };
  } catch (err) {
    console.error("SERVER ACTION ERROR [updateDrive]:", err);
    return {
      status: "error",
      message:
        err instanceof Error
          ? err.message
          : "Couldn't save these changes. Please try again.",
    };
  }
}

export type DeleteDriveState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Admin-only, and refuses to touch a drive with any real history attached
 * — a swipe gesture is not the place to silently cascade-delete
 * registrations or trip reports. Meant for cleaning up an accidentally
 * created or duplicate drive, not retiring one people actually showed up
 * to. */
export async function deleteDrive(driveId: string): Promise<DeleteDriveState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to delete a drive." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { status: "error", message: "Only Admins can delete a drive." };
  }

  const [{ count: registrationCount }, { count: reportCount }] = await Promise.all([
    supabase
      .from("drive_registrations")
      .select("id", { count: "exact", head: true })
      .eq("drive_id", driveId),
    supabase
      .from("trip_reports")
      .select("id", { count: "exact", head: true })
      .eq("drive_id", driveId),
  ]);

  if ((registrationCount ?? 0) > 0 || (reportCount ?? 0) > 0) {
    return {
      status: "error",
      message:
        "This drive has registrations or trip reports attached — it can't be deleted. Cancel it instead if it's no longer happening.",
    };
  }

  const { error } = await supabase.from("drives").delete().eq("id", driveId);

  if (error) {
    console.error("SERVER ACTION ERROR [deleteDrive]:", error);
    return { status: "error", message: "Couldn't delete this drive. Please try again." };
  }

  revalidatePath("/drives");

  return { status: "success", message: "Drive deleted." };
}

export type DriveQuickActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

async function requireMarshalOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, isMarshal: false, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_marshal, is_admin")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    isMarshal: profile?.is_marshal ?? false,
    isAdmin: profile?.is_admin ?? false,
  };
}

/** Quick-action toggle from the Marshal Logistics Control Panel — a
 * standalone flip, not routed through the full updateDrive form. Reversible
 * by design: a Marshal can reopen if they closed by mistake or a slot frees
 * up, without needing to touch the drive's actual `status`. */
export async function setRegistrationClosed(
  driveId: string,
  closed: boolean,
): Promise<DriveQuickActionState> {
  const { supabase, user, isMarshal, isAdmin } = await requireMarshalOrAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isMarshal && !isAdmin) {
    return { status: "error", message: "Only Marshals and Admins can manage registration." };
  }

  const { data: drive, error: fetchError } = await supabase
    .from("drives")
    .select("status")
    .eq("id", driveId)
    .single();

  if (fetchError || !drive) {
    return { status: "error", message: "Couldn't find that drive." };
  }
  if (drive.status !== "Scheduled") {
    return {
      status: "error",
      message: `Registration can't be managed on a drive marked ${drive.status}.`,
    };
  }

  const { error } = await supabase
    .from("drives")
    .update({ registration_closed: closed })
    .eq("id", driveId);

  if (error) {
    console.error("SERVER ACTION ERROR [setRegistrationClosed]:", error);
    return { status: "error", message: "Couldn't update registration status. Please try again." };
  }

  revalidatePath(`/drives/${driveId}`);
  revalidatePath("/drives");

  return {
    status: "success",
    message: closed ? "Registration closed." : "Registration reopened.",
  };
}

/** Marshals can only complete a drive that has actually finished — the
 * whole point of the check is that a Marshal shouldn't be able to mark
 * "Completed" on something that hasn't happened yet. Admins can override
 * with `force`, but still only via this same server-verified path (the
 * client shows its own confirm prompt first — see MarkDriveCompletedButton
 * — this is the real enforcement, not the confirm dialog). */
export async function markDriveCompleted(
  driveId: string,
  force: boolean,
): Promise<DriveQuickActionState> {
  const { supabase, user, isMarshal, isAdmin } = await requireMarshalOrAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isMarshal && !isAdmin) {
    return { status: "error", message: "Only Marshals and Admins can complete a drive." };
  }

  const { data: drive, error: fetchError } = await supabase
    .from("drives")
    .select("drive_date, drive_end_time, status")
    .eq("id", driveId)
    .single();

  if (fetchError || !drive) {
    return { status: "error", message: "Couldn't find that drive." };
  }
  if (drive.status === "Completed") {
    return { status: "error", message: "This drive is already marked Completed." };
  }

  const finishAt = new Date(
    drive.drive_end_time ? `${drive.drive_date}T${drive.drive_end_time}` : `${drive.drive_date}T23:59:59`,
  );
  const hasFinished = new Date() >= finishAt;

  if (!hasFinished && !(isAdmin && force)) {
    return {
      status: "error",
      message: isAdmin
        ? "This drive hasn't finished yet — pass force to override."
        : "This drive hasn't finished yet. Only an Admin can mark it completed early.",
    };
  }

  const { error } = await supabase
    .from("drives")
    .update({ status: "Completed" })
    .eq("id", driveId);

  if (error) {
    console.error("SERVER ACTION ERROR [markDriveCompleted]:", error);
    return { status: "error", message: "Couldn't mark this drive completed. Please try again." };
  }

  revalidatePath(`/drives/${driveId}`);
  revalidatePath("/drives");

  return { status: "success", message: "Drive marked as completed." };
}

export async function toggleDriveReaction(driveId: string): Promise<ToggleReactionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", liked: false, message: "You need to be signed in to like this." };
  }

  const { data: existing } = await supabase
    .from("drive_reactions")
    .select("id")
    .eq("drive_id", driveId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("drive_reactions").delete().eq("id", existing.id);
    if (error) {
      console.error("SERVER ACTION ERROR [toggleDriveReaction]:", error);
      return { status: "error", liked: true, message: "Couldn't unlike this. Please try again." };
    }
    revalidatePath("/drives");
    revalidatePath(`/drives/${driveId}`);
    return { status: "success", liked: false };
  }

  const { error } = await supabase
    .from("drive_reactions")
    .insert({ drive_id: driveId, user_id: user.id, reaction_type: "like" });
  if (error) {
    console.error("SERVER ACTION ERROR [toggleDriveReaction]:", error);
    return { status: "error", liked: false, message: "Couldn't like this. Please try again." };
  }
  revalidatePath("/drives");
  revalidatePath(`/drives/${driveId}`);
  return { status: "success", liked: true };
}
