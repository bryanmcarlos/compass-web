"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAvailableRoles, type RegistrationRole } from "@/lib/driveRoles";
import { rankNameFromLevel } from "@/lib/constants";

export type RegisterDriveState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export async function hasSupervisingMarshal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driveId: string,
) {
  const { data } = await supabase
    .from("drive_registrations")
    .select("user:profiles(current_rank)")
    .eq("drive_id", driveId)
    .eq("role", "Support")
    .overrideTypes<{ user: { current_rank: number } | null }[], { merge: false }>();

  return (data ?? []).some((r) => r.user?.current_rank === 5);
}

/** Member (rank 0) eligibility is a policy overlay, not part of the rank
 * hierarchy getAvailableRoles encodes — a Member can only ever join an All
 * Levels drive, or a single Newbie-only drive at a time (checked by "no
 * other currently-held Newbie-only registration", not a lifetime-use flag,
 * so an unregistered/cancelled attempt doesn't permanently lock them out). */
export async function checkMemberEligibleForDrive(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  driveId: string,
  allowedRanks: string[],
  isAllLevels: boolean,
): Promise<boolean> {
  if (isAllLevels) return true;

  const isPureNewbieDrive = allowedRanks.length === 1 && allowedRanks[0] === "1";
  if (!isPureNewbieDrive) return false;

  const { data: existing } = await supabase
    .from("drive_registrations")
    .select("drive_id, drives!inner(allowed_ranks, is_all_levels)")
    .eq("user_id", userId)
    .neq("drive_id", driveId);

  return !(existing ?? []).some((r) => {
    const d = r.drives as unknown as { allowed_ranks: string[] | null; is_all_levels: boolean };
    return !d.is_all_levels && d.allowed_ranks?.length === 1 && d.allowed_ranks[0] === "1";
  });
}

export async function registerForDrive(
  _prevState: RegisterDriveState,
  formData: FormData,
): Promise<RegisterDriveState> {
  const supabase = await createClient();

  // Every Server Function is a public POST endpoint, reachable directly and
  // not just through this form — re-derive rank, target rank, and slot
  // capacity here rather than trusting anything the client sent except which
  // drive and (when eligible) which support role was chosen.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You need to be signed in to register for a drive.",
    };
  }

  const driveId = String(formData.get("driveId") ?? "").trim();
  if (!driveId) {
    return { status: "error", message: "Missing drive." };
  }

  // The checkbox also disables the submit button client-side, but that's a
  // UX nicety, not a guarantee — a direct POST could omit it entirely.
  if (formData.get("acceptedWaiver") !== "on") {
    return {
      status: "error",
      message: "You must accept the waiver and release of liability to register.",
    };
  }

  const [{ data: profile, error: profileError }, { data: drive, error: driveError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("current_rank, is_mit")
        .eq("id", user.id)
        .single(),
      supabase
        .from("drives")
        .select("target_rank, max_drivers, has_camp, allowed_ranks, is_all_levels, status, registration_closed")
        .eq("id", driveId)
        .single(),
    ]);

  if (profileError || !profile) {
    return {
      status: "error",
      message: "Couldn't load your profile. Please try again.",
    };
  }
  if (driveError || !drive) {
    return { status: "error", message: "Couldn't find that drive." };
  }

  // The drive page hides the form once closed, but that's UI only — a
  // direct POST could still reach this action, so the real gate is here.
  if (drive.status !== "Scheduled" || drive.registration_closed) {
    return { status: "error", message: "Registration for this drive is closed." };
  }

  // Rank 0 (Member) is below the floor of every real target_rank by
  // definition — this check only applies to ranked members; a Member's
  // actual eligibility is decided below by checkMemberEligibleForDrive.
  if (profile.current_rank !== 0 && profile.current_rank < drive.target_rank) {
    return {
      status: "error",
      message: "Your rank doesn't qualify for this drive yet.",
    };
  }

  // Re-derive eligible roles here rather than trusting the client's dropdown
  // — including the Marshal-in-Training "Lead" exception, which depends on
  // live registration data (a supervising Marshal) that could have changed
  // between page load and submission.
  const availableRoles =
    profile.current_rank === 0
      ? (await checkMemberEligibleForDrive(
            supabase,
            user.id,
            driveId,
            drive.allowed_ranks,
            drive.is_all_levels,
          ))
        ? (["Driver"] as RegistrationRole[])
        : []
      : getAvailableRoles({
          currentRank: profile.current_rank,
          isMit: profile.is_mit ?? false,
          targetRank: drive.target_rank,
          allowedRanks: drive.allowed_ranks.map(Number),
          isAllLevels: drive.is_all_levels,
          hasSupervisingMarshal: await hasSupervisingMarshal(supabase, driveId),
        });

  if (availableRoles.length === 0) {
    return {
      status: "error",
      message: "Your rank doesn't have an available role on this drive.",
    };
  }

  const requestedRole = String(formData.get("role") ?? "") as RegistrationRole;
  const role = availableRoles.includes(requestedRole)
    ? requestedRole
    : availableRoles.length === 1
      ? availableRoles[0]
      : null;

  if (!role) {
    return {
      status: "error",
      message: "Choose a valid role for this drive.",
    };
  }

  if (role === "Driver") {
    // max_drivers only caps rank-matching 'Driver' slots — Support/Lead
    // registrations are additional helpers and aren't limited by it.
    const { count, error: countError } = await supabase
      .from("drive_registrations")
      .select("id", { count: "exact", head: true })
      .eq("drive_id", driveId)
      .eq("role", "Driver");

    if (countError) {
      return {
        status: "error",
        message: "Couldn't check available slots. Please try again.",
      };
    }
    if ((count ?? 0) >= drive.max_drivers) {
      return {
        status: "error",
        message: "This drive's driver slots are full.",
      };
    }
  }

  // Only meaningful (and only ever true) when the drive actually offers
  // camping — a crafted POST can't RSVP for camping on a drive that has none.
  const joiningCamp = drive.has_camp && formData.get("joiningCamp") === "on";

  const { error: insertError } = await supabase
    .from("drive_registrations")
    .insert({
      drive_id: driveId,
      user_id: user.id,
      role,
      joining_camp: joiningCamp,
      // Only reachable past the acceptedWaiver check above, so this is
      // always a true acceptance, never a default/assumed value.
      disclaimer_accepted: true,
      // Snapshot of the registrant's rank *at registration time* — the
      // Convoy Roster groups by this, not by their current (possibly
      // since-promoted) profile rank. Only meaningful for Driver rows.
      driver_rank: role === "Driver" ? rankNameFromLevel(profile.current_rank) : null,
    });

  if (insertError) {
    return {
      status: "error",
      message:
        insertError.code === "23505"
          ? "You're already registered for this drive."
          : "Couldn't register you for this drive. Please try again.",
    };
  }

  revalidatePath(`/drives/${driveId}`);

  return { status: "success", message: "You're registered! See you on the trail." };
}

export type UnregisterResult = {
  status: "error" | "success";
  message: string | null;
};

export async function unregisterFromDrive(
  driveId: string,
): Promise<UnregisterResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You need to be signed in to leave a drive.",
    };
  }

  const [{ data: drive }, { data: existingReport }] = await Promise.all([
    supabase.from("drives").select("status").eq("id", driveId).single(),
    supabase.from("trip_reports").select("id").eq("drive_id", driveId).limit(1).maybeSingle(),
  ]);

  // Once a drive is marked Completed, or a trip report has already been
  // filed for it, the roster is part of that drive's historical record —
  // unregistering at that point would silently rewrite who was actually
  // there, so it's blocked rather than allowed and only caught later.
  if (drive?.status === "Completed" || existingReport) {
    return {
      status: "error",
      message: "This drive has already been completed and reported on, so you can no longer unregister from it.",
    };
  }

  const { error: deleteError } = await supabase
    .from("drive_registrations")
    .delete()
    .eq("drive_id", driveId)
    .eq("user_id", user.id);

  if (deleteError) {
    return {
      status: "error",
      message: "Couldn't remove your registration. Please try again.",
    };
  }

  // Best-effort audit trail — the unregistration itself already succeeded,
  // so a failure here shouldn't be surfaced as a failed request.
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "UNREGISTER_FROM_DRIVE",
    details: { drive_id: driveId },
  });
  if (auditError) {
    console.error(
      "Failed to write audit log for UNREGISTER_FROM_DRIVE",
      auditError,
    );
  }

  revalidatePath(`/drives/${driveId}`);

  return { status: "success", message: "You've left this drive." };
}
