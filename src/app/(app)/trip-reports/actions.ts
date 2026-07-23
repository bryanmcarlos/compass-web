"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { validateImageFile } from "@/lib/imageUpload";
import { cloudinaryConfigured, uploadBufferToCloudinary } from "@/lib/cloudinary";
import type { ToggleReactionState } from "@/components/club/LikeButton";

export type SubmitReportState = {
  status: "idle" | "error" | "success";
  message: string | null;
  /** Set when the error is "you already have a report for this drive" —
   * lets the UI link straight to it instead of just naming the problem. */
  existingReportId?: string | null;
};

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type UploadImageState = {
  status: "idle" | "error" | "success";
  message: string | null;
  url?: string | null;
};

/** One call per photo — the dropzone invokes this immediately for each
 * file as it's dropped/selected, not deferred to the report's final
 * submit. Signed in only; no drive/author check, since a photo isn't tied
 * to anything yet at upload time (the report it ends up attached to is
 * validated separately by submitTripReport). CLOUDINARY_API_SECRET is only
 * ever read here, server-side — never part of any prop, form field, or
 * response sent to the client. */
export async function uploadImageToCloudinary(formData: FormData): Promise<UploadImageState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to upload photos." };
  }

  const validation = validateImageFile(formData.get("file"));
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  if (!cloudinaryConfigured()) {
    console.error(
      "SERVER ACTION ERROR [uploadImageToCloudinary]: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set.",
    );
    return {
      status: "error",
      message: "Photo uploads aren't configured on this server yet — ask an admin to set up Cloudinary.",
    };
  }

  const buffer = Buffer.from(await validation.file.arrayBuffer());
  const result = await uploadBufferToCloudinary(buffer, "compass_trip_reports");

  if (!result.ok) {
    return {
      status: "error",
      message: result.timedOut
        ? "This upload is taking too long — check your connection and try again."
        : "Couldn't upload this photo. Please try again.",
    };
  }

  return { status: "success", message: "Photo uploaded.", url: result.url };
}

/** Applies the Member -> Newbie auto-promotion and posts a celebratory
 * announcement, if this report's author/drive combination qualifies —
 * called at the moment a report actually *becomes* approved, whether
 * that's immediately at submission (approval not required) or later when a
 * marshal approves a previously-pending one. Best-effort throughout: the
 * report itself already saved/approved successfully by the time this runs,
 * so a failure here is logged, never surfaced as a failed request. Doesn't
 * touch this registration's own drive_registrations row — driver_rank
 * stays "Member" as a historically-accurate snapshot of what they were at
 * registration time, not retroactively rewritten. */
async function maybePromoteAndAnnounce(
  supabase: Awaited<ReturnType<typeof createClient>>,
  authorId: string,
  driveId: string,
): Promise<void> {
  const [{ data: profile }, { data: drive }] = await Promise.all([
    supabase.from("profiles").select("current_rank, username, full_name").eq("id", authorId).single(),
    supabase.from("drives").select("allowed_ranks, is_all_levels, title").eq("id", driveId).single(),
  ]);

  const qualifies =
    profile?.current_rank === 0 &&
    !drive?.is_all_levels &&
    drive?.allowed_ranks?.length === 1 &&
    drive.allowed_ranks[0] === "1";

  if (!qualifies) return;

  const { error: promoteError } = await supabase
    .from("profiles")
    .update({ current_rank: 1 })
    .eq("id", authorId);
  if (promoteError) {
    console.error("Failed to auto-promote Member to Newbie", promoteError);
    return; // Don't post a congratulations for a promotion that didn't actually happen.
  }

  const memberName = profile?.full_name ?? profile?.username ?? "A member";
  const { error: announceError } = await supabase.from("announcements").insert({
    title: `🎉 ${memberName} is now a Newbie!`,
    content: `${memberName} completed their first Newbie drive${
      drive?.title ? ` (${drive.title})` : ""
    } and has been promoted from Member to Newbie. Welcome to the club!`,
    category: "Promotion",
    target_rank: 1,
    published_at: new Date().toISOString(),
  });
  if (announceError) {
    console.error("Failed to post promotion announcement", announceError);
  }
}

export async function submitTripReport(
  _prevState: SubmitReportState,
  formData: FormData,
): Promise<SubmitReportState> {
  const supabase = await createClient();

  // Every Server Function is a public POST endpoint, reachable directly and
  // not just through this form — always re-verify the session here rather
  // than trusting that only a logged-in user could have reached this code.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You need to be signed in to submit a trip report.",
    };
  }

  const driveId = String(formData.get("driveId") ?? "").trim();
  const reportText = String(formData.get("reportText") ?? "").trim();

  // A drive is optional — a report can stand on its own (drive_id null) or
  // be tied to a specific completed drive.
  if (reportText.length < 20) {
    return {
      status: "error",
      message: "Tell us a bit more about the drive — at least 20 characters.",
    };
  }

  // One hidden `photoUrls` input per successfully-uploaded photo (the
  // dropzone already uploaded each to Cloudinary individually and only
  // renders the hidden input once that succeeds) — getAll rather than the
  // old single newline-joined field.
  const photos = formData
    .getAll("photoUrls")
    .map((value) => String(value).trim())
    .filter(Boolean);

  // The dropzone only ever produces real Cloudinary secure_urls, so this
  // should never actually fire in normal use — kept as defense-in-depth
  // against a tampered request, same as every other Server Action here
  // that never trusts client-submitted data at face value.
  const invalidUrl = photos.find((url) => !isValidHttpUrl(url));
  if (invalidUrl) {
    return {
      status: "error",
      message: `"${invalidUrl}" doesn't look like a valid image URL.`,
    };
  }

  // A floating report (no drive_id) has nothing to be "registered for" —
  // this check only applies once a specific drive is targeted.
  if (driveId) {
    const { data: registration } = await supabase
      .from("drive_registrations")
      .select("id")
      .eq("drive_id", driveId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!registration) {
      return {
        status: "error",
        message:
          "Access Denied: You can only submit a trip report for a drive you officially registered for.",
      };
    }

    // Explicit pre-check for a precise, actionable message — the unique
    // constraint on (author_id, drive_id) is still the real enforcement and
    // stays as a fallback below for the race-condition case where two
    // submissions for the same drive land at nearly the same instant.
    const { data: existingReport } = await supabase
      .from("trip_reports")
      .select("id")
      .eq("drive_id", driveId)
      .eq("author_id", user.id)
      .maybeSingle();

    if (existingReport) {
      return {
        status: "error",
        message:
          "You have already submitted a trip report for this drive. You can view it from your existing report.",
        existingReportId: existingReport.id,
      };
    }
  }

  // Same client, one extra cheap read — not worth spinning up the separate
  // anon-key client getAppSettings() uses elsewhere, since this action
  // already has a session-bound one open for the insert right below.
  // Defaults to requiring approval (the conservative, pre-existing
  // behavior) if the flag can't be read for any reason.
  const { data: settings } = await supabase
    .from("app_settings")
    .select("require_trip_report_approval")
    .eq("id", 1)
    .maybeSingle();
  const requireApproval = settings?.require_trip_report_approval ?? true;

  const { data: report, error: insertError } = await supabase
    .from("trip_reports")
    .insert({
      drive_id: driveId || null,
      author_id: user.id,
      report_text: reportText,
      photos: photos.length > 0 ? photos : null,
      is_approved: !requireApproval,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Race-condition fallback — the pre-check above didn't catch it
      // (concurrent submission), but we don't have the existing report's id
      // handy here without another query, so this path just names the
      // problem rather than also linking to it.
      return {
        status: "error",
        message: "You have already submitted a trip report for this drive.",
      };
    }
    return {
      status: "error",
      message: "Couldn't save your report right now. Please try again.",
    };
  }

  // Best-effort audit trail — the report itself already saved successfully,
  // so a failure here shouldn't be surfaced as a failed submission.
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "SUBMIT_TRIP_REPORT",
    details: { trip_report_id: report.id, drive_id: driveId || null },
  });
  if (auditError) {
    console.error(
      "Failed to write audit log for SUBMIT_TRIP_REPORT",
      auditError,
    );
  }

  // Promotion only fires once the report is *actually* approved — when
  // marshal approval isn't required, that's right now (is_approved was set
  // true above); when it is required, this report is still pending and the
  // equivalent call in approveTripReport handles it later instead. This was
  // previously firing unconditionally at submission regardless of approval
  // state — fixed to match the spec ("marshal approval... triggers rank
  // promotion"), not "submission triggers it."
  if (!requireApproval && driveId) {
    await maybePromoteAndAnnounce(supabase, user.id, driveId);
  }

  revalidatePath("/trip-reports");
  if (driveId) {
    revalidatePath(`/drives/${driveId}`);
  }

  // redirect() throws a framework-handled control-flow exception — it must
  // stay outside any try/catch (none wraps this function), or it would be
  // caught and reported as a real error instead of performing the
  // navigation. Same pattern as createDrive.
  //
  // Moderation on: land back on the drive (there's context to read there —
  // roster, other reports); with no drive to land on, fall back to the
  // report's own page, which its own author can always view even pending.
  // Moderation off: straight to the now-live report.
  if (requireApproval) {
    redirect(
      driveId
        ? `/drives/${driveId}?reportSubmitted=pending`
        : `/trip-reports/${report.id}?reportSubmitted=pending`,
    );
  }
  redirect(`/trip-reports/${report.id}?reportSubmitted=live`);
}

export type LinkDriveState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Retroactively attaches (or detaches, when `driveId` is null) a trip
 * report to a drive. Marshal or Admin only — a normal author can no longer
 * re-link or detach their own report once submitted (see AttachToDriveControl's
 * gating on trip-reports/[id]/page.tsx). A Marshal additionally requires the
 * report's author to have actually been registered on the target drive —
 * an Admin can override that (the client shows a confirm warning first; the
 * real enforcement is here, not the confirm dialog). */
export async function linkTripReportToDrive(
  reportId: string,
  driveId: string | null,
): Promise<LinkDriveState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const [{ data: report }, { data: profile }] = await Promise.all([
    supabase.from("trip_reports").select("author_id").eq("id", reportId).single(),
    supabase.from("profiles").select("is_admin, is_marshal").eq("id", user.id).single(),
  ]);

  if (!report) {
    return { status: "error", message: "Couldn't find that trip report." };
  }

  const isAdmin = profile?.is_admin ?? false;
  const isMarshal = profile?.is_marshal ?? false;
  if (!isMarshal && !isAdmin) {
    return {
      status: "error",
      message: "Only a Marshal or Super Admin can attach a report to a drive.",
    };
  }

  if (driveId && isMarshal && !isAdmin) {
    const { data: registration } = await supabase
      .from("drive_registrations")
      .select("id")
      .eq("drive_id", driveId)
      .eq("user_id", report.author_id)
      .maybeSingle();

    if (!registration) {
      return {
        status: "error",
        message:
          "This report's author wasn't registered on that drive — only a Super Admin can override this.",
      };
    }
  }

  const { error } = await supabase
    .from("trip_reports")
    .update({ drive_id: driveId })
    .eq("id", reportId);

  if (error) {
    console.error("SERVER ACTION ERROR [linkTripReportToDrive]:", error);
    return { status: "error", message: "Couldn't update this report. Please try again." };
  }

  revalidatePath(`/trip-reports/${reportId}`);
  revalidatePath("/trip-reports");
  if (driveId) {
    revalidatePath(`/drives/${driveId}`);
  }

  return {
    status: "success",
    message: driveId ? "Report attached to drive." : "Report detached from drive.",
  };
}

export type RelinkState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Admin-only, purpose-built for the data-cleanup tool on the drive detail
 * page and the /trip-reports "Unlinked Reports" panel. Thread-aware: a
 * migrated report (trip_reports.thread_id set) is never linked alone —
 * linking any post from a thread moves `threads.drive_id` and cascades
 * `drive_id` to every row sharing that thread_id, so the root post and all
 * its replies move together. An organic report (thread_id null, submitted
 * through the live app) still links as a single row, exactly as before.
 * Either way, whatever currently occupies the target drive — another whole
 * thread, a standalone organic report, or both — is detached first, since
 * this tool treats a drive's link as a single canonical slot. */
export async function relinkTripReportToDrive(
  reportId: string,
  driveId: string,
): Promise<RelinkState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { status: "error", message: "Only Admins can use the linking cleanup tool." };
  }

  const { data: target } = await supabase
    .from("trip_reports")
    .select("id, thread_id")
    .eq("id", reportId)
    .single();

  if (!target) {
    return { status: "error", message: "Couldn't find that trip report." };
  }

  const { data: occupying } = await supabase
    .from("trip_reports")
    .select("id, thread_id")
    .eq("drive_id", driveId);

  const isDisplaced = (row: { id: string; thread_id: string | null }) =>
    target.thread_id ? row.thread_id !== target.thread_id : row.id !== reportId;

  const displacedRows = (occupying ?? []).filter(isDisplaced);
  const displacedThreadIds = Array.from(
    new Set(displacedRows.map((r) => r.thread_id).filter((t): t is string => t !== null)),
  );
  const displacedOrganicIds = displacedRows.filter((r) => r.thread_id === null).map((r) => r.id);

  if (displacedThreadIds.length > 0) {
    const [{ error: detachThreadsError }, { error: detachThreadReportsError }] = await Promise.all([
      supabase.from("threads").update({ drive_id: null }).in("id", displacedThreadIds),
      supabase.from("trip_reports").update({ drive_id: null }).in("thread_id", displacedThreadIds),
    ]);
    if (detachThreadsError || detachThreadReportsError) {
      console.error(
        "SERVER ACTION ERROR [relinkTripReportToDrive detach threads]:",
        detachThreadsError ?? detachThreadReportsError,
      );
      return {
        status: "error",
        message: "Couldn't detach the previously linked thread(s) — nothing was changed.",
      };
    }
  }

  if (displacedOrganicIds.length > 0) {
    const { error: detachOrganicError } = await supabase
      .from("trip_reports")
      .update({ drive_id: null })
      .in("id", displacedOrganicIds);
    if (detachOrganicError) {
      console.error("SERVER ACTION ERROR [relinkTripReportToDrive detach organic]:", detachOrganicError);
      return {
        status: "error",
        message: "Couldn't detach the previously linked report(s) — nothing was changed.",
      };
    }
  }

  if (target.thread_id) {
    const [{ error: threadError }, { error: threadReportsError }] = await Promise.all([
      supabase.from("threads").update({ drive_id: driveId }).eq("id", target.thread_id),
      supabase.from("trip_reports").update({ drive_id: driveId }).eq("thread_id", target.thread_id),
    ]);
    if (threadError || threadReportsError) {
      console.error(
        "SERVER ACTION ERROR [relinkTripReportToDrive link thread]:",
        threadError ?? threadReportsError,
      );
      return { status: "error", message: "Couldn't link this thread. Please try again." };
    }
  } else {
    const { error } = await supabase
      .from("trip_reports")
      .update({ drive_id: driveId })
      .eq("id", reportId);
    if (error) {
      console.error("SERVER ACTION ERROR [relinkTripReportToDrive]:", error);
      return { status: "error", message: "Couldn't link this report. Please try again." };
    }
  }

  revalidatePath("/trip-reports");
  revalidatePath(`/trip-reports/${reportId}`);
  revalidatePath(`/drives/${driveId}`);

  return {
    status: "success",
    message:
      displacedRows.length > 0
        ? `Linked — detached ${displacedRows.length} previously-linked report${displacedRows.length > 1 ? "s" : ""}.`
        : "Linked.",
  };
}

export type ApproveReportState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Marshal or Admin only, re-derived server-side. Rank alone was never the
 * gate anywhere else in this app — `is_marshal`/`is_admin` are the real
 * authorization flags (a rank-5 profile without is_marshal set, or an MIT
 * member, are both handled specially elsewhere for exactly this reason),
 * so this checks those rather than current_rank. */
export async function approveTripReport(reportId: string): Promise<ApproveReportState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_marshal, is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_marshal && !profile?.is_admin) {
    return { status: "error", message: "Only Marshals or Admins can approve trip reports." };
  }

  const { data: report, error } = await supabase
    .from("trip_reports")
    .update({ is_approved: true })
    .eq("id", reportId)
    .select("drive_id, author_id")
    .single();

  if (error) {
    console.error("SERVER ACTION ERROR [approveTripReport]:", error);
    // Most likely cause: no RLS UPDATE policy yet lets a Marshal/Admin write
    // to a trip_reports row they don't own (see the migration this app's
    // other cross-user write features all needed) — that surfaces here as
    // PGRST116 ("no rows returned") because the UPDATE silently matched 0
    // rows rather than as a permission-denied error. Returning the real
    // message instead of a generic string, consistent with the rest of this
    // codebase's Server Actions, so this doesn't have to be re-diagnosed
    // blind next time.
    return {
      status: "error",
      message:
        error.code === "PGRST116"
          ? "Couldn't approve this report — the database rejected the update (likely a missing permissions policy, not a client bug). See server logs / ask an admin to check RLS on trip_reports."
          : error.message,
    };
  }

  if (report?.drive_id && report.author_id) {
    await maybePromoteAndAnnounce(supabase, report.author_id, report.drive_id);
  }

  revalidatePath("/trip-reports");
  revalidatePath(`/trip-reports/${reportId}`);
  if (report?.drive_id) {
    revalidatePath(`/drives/${report.drive_id}`);
  }

  return { status: "success", message: "Report approved." };
}

export type UpdateReportState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Author-only — deliberately narrower than linkTripReportToDrive/
 * approveTripReport, which both also allow an Admin. Rewriting someone
 * else's personal account of a drive is a different kind of intervention
 * than re-linking metadata or moderating visibility; nothing here asked for
 * admin edit access, so it isn't granted implicitly. */
export async function updateTripReport(
  _prevState: UpdateReportState,
  formData: FormData,
): Promise<UpdateReportState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!reportId) {
    return { status: "error", message: "Missing report." };
  }

  const { data: report } = await supabase
    .from("trip_reports")
    .select("author_id")
    .eq("id", reportId)
    .single();

  if (!report) {
    return { status: "error", message: "Couldn't find that trip report." };
  }
  if (report.author_id !== user.id) {
    return { status: "error", message: "You can only edit your own trip report." };
  }

  const reportText = String(formData.get("reportText") ?? "").trim();
  if (reportText.length < 20) {
    return {
      status: "error",
      message: "Tell us a bit more about the drive — at least 20 characters.",
    };
  }

  const photos = formData
    .getAll("photoUrls")
    .map((value) => String(value).trim())
    .filter(Boolean);

  const invalidUrl = photos.find((url) => !isValidHttpUrl(url));
  if (invalidUrl) {
    return { status: "error", message: `"${invalidUrl}" doesn't look like a valid image URL.` };
  }

  const { error } = await supabase
    .from("trip_reports")
    .update({
      report_text: reportText,
      photos: photos.length > 0 ? photos : null,
    })
    .eq("id", reportId);

  if (error) {
    console.error("SERVER ACTION ERROR [updateTripReport]:", error);
    return { status: "error", message: "Couldn't save your changes. Please try again." };
  }

  revalidatePath("/trip-reports");
  revalidatePath(`/trip-reports/${reportId}`);

  redirect(`/trip-reports/${reportId}?reportSubmitted=updated`);
}

export type DeleteReportState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Admin-only, checked against profiles.is_admin — this app has no
 * "Admin"/"Super Admin" rank string anywhere (current_rank is a plain
 * integer 1-5, Newbie through Marshal, verified against the live schema
 * before writing this); is_admin is the one real flag every other
 * admin-gated action here already keys off. Returns a typed error state
 * rather than throwing, same as every other Server Action in this file —
 * none of this app's client call sites wrap their action calls in
 * try/catch, so a raw throw would surface as an unhandled rejection
 * instead of the inline error message a caller can actually render.
 *
 * Permanent. Unlike every other trip-report action so far (disable, unlink,
 * un-approve-via-edit are all reversible), there's no undo here. */
export async function deleteTripReport(reportId: string): Promise<DeleteReportState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { status: "error", message: "Only Admins can delete trip reports." };
  }

  // Read drive_id before deleting — needed to know which drive page to
  // revalidate, and gone from the table the moment the delete succeeds.
  const { data: report, error: fetchError } = await supabase
    .from("trip_reports")
    .select("drive_id")
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { status: "error", message: "Couldn't find that trip report." };
  }

  const { error } = await supabase.from("trip_reports").delete().eq("id", reportId);

  if (error) {
    console.error("SERVER ACTION ERROR [deleteTripReport]:", error);
    return { status: "error", message: "Couldn't delete this report. Please try again." };
  }

  revalidatePath("/trip-reports");
  revalidatePath(`/trip-reports/${reportId}`);
  if (report.drive_id) {
    revalidatePath(`/drives/${report.drive_id}`);
  }

  return { status: "success", message: "Trip report deleted." };
}

export type SubmitCommentState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export async function submitComment(
  _prevState: SubmitCommentState,
  formData: FormData,
): Promise<SubmitCommentState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to comment." };
  }

  const reportId = String(formData.get("reportId") ?? "").trim();
  const commentText = String(formData.get("commentText") ?? "").trim();

  if (!reportId) {
    return { status: "error", message: "Missing report." };
  }
  if (commentText.length === 0) {
    return { status: "error", message: "Write something before posting." };
  }
  if (commentText.length > 2000) {
    return { status: "error", message: "Comments are limited to 2000 characters." };
  }

  // Re-verify the report exists and is approved server-side — never trust a
  // client-passed id, and this also blocks commenting on a pending report a
  // viewer shouldn't legitimately be able to see yet.
  const { data: report } = await supabase
    .from("trip_reports")
    .select("id, is_approved")
    .eq("id", reportId)
    .maybeSingle();

  if (!report) {
    return { status: "error", message: "Couldn't find that trip report." };
  }
  if (!report.is_approved) {
    return { status: "error", message: "You can only comment on an approved trip report." };
  }

  const { error } = await supabase
    .from("comments")
    .insert({ trip_report_id: reportId, author_id: user.id, comment_text: commentText });

  if (error) {
    console.error("SERVER ACTION ERROR [submitComment]:", error);
    return { status: "error", message: "Couldn't post your comment. Please try again." };
  }

  revalidatePath("/trip-reports");

  return { status: "success", message: "Comment posted." };
}

export async function toggleTripReportReaction(reportId: string): Promise<ToggleReactionState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", liked: false, message: "You need to be signed in to like this." };
  }

  const { data: existing } = await supabase
    .from("report_reactions")
    .select("id")
    .eq("trip_report_id", reportId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("report_reactions").delete().eq("id", existing.id);
    if (error) {
      console.error("SERVER ACTION ERROR [toggleTripReportReaction]:", error);
      return { status: "error", liked: true, message: "Couldn't unlike this. Please try again." };
    }
    revalidatePath("/trip-reports");
    return { status: "success", liked: false };
  }

  const { error } = await supabase
    .from("report_reactions")
    .insert({ trip_report_id: reportId, user_id: user.id, reaction_type: "like" });
  if (error) {
    console.error("SERVER ACTION ERROR [toggleTripReportReaction]:", error);
    return { status: "error", liked: false, message: "Couldn't like this. Please try again." };
  }
  revalidatePath("/trip-reports");
  return { status: "success", liked: true };
}
