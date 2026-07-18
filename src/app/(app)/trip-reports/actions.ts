"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

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
  const photoUrlsRaw = String(formData.get("photoUrls") ?? "");

  // A drive is optional — a report can stand on its own (drive_id null) or
  // be tied to a specific completed drive.
  if (reportText.length < 20) {
    return {
      status: "error",
      message: "Tell us a bit more about the drive — at least 20 characters.",
    };
  }

  const photos = photoUrlsRaw
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  const invalidUrl = photos.find((url) => !isValidHttpUrl(url));
  if (invalidUrl) {
    return {
      status: "error",
      message: `"${invalidUrl}" doesn't look like a valid image URL.`,
    };
  }

  // A floating report (no drive_id) has nothing to be "registered for" —
  // both checks below only apply once a specific drive is targeted.
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
 * report to a drive. Restricted to the report's own author or a Super
 * Admin — re-derived server-side from the caller's session, never trusted
 * from the client. */
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
    supabase.from("profiles").select("is_admin").eq("id", user.id).single(),
  ]);

  if (!report) {
    return { status: "error", message: "Couldn't find that trip report." };
  }

  const isAuthor = report.author_id === user.id;
  const isAdmin = profile?.is_admin ?? false;
  if (!isAuthor && !isAdmin) {
    return {
      status: "error",
      message: "Only the report's author or a Super Admin can attach it to a drive.",
    };
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
    .select("drive_id")
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

  revalidatePath("/trip-reports");
  revalidatePath(`/trip-reports/${reportId}`);
  if (report?.drive_id) {
    revalidatePath(`/drives/${report.drive_id}`);
  }

  return { status: "success", message: "Report approved." };
}
