"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAvailableRoles, ALL_REGISTRATION_ROLES, type RegistrationRole } from "@/lib/driveRoles";
import { hasSupervisingMarshal, checkMemberEligibleForDrive } from "./actions";
import { rankNameFromLevel } from "@/lib/constants";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Local-date (not UTC) "YYYY-MM-DD" — matches how drive_date is already
 * treated elsewhere in this app (see formatDate's own local-time comment)
 * rather than risking a UTC/local off-by-one at the day boundary. */
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function requireSuperUser(supabase: SupabaseServerClient) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, isSuperUser: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, current_rank")
    .eq("id", user.id)
    .single();

  // Same expression as the Drive Detail page's own isSuperUser derivation —
  // no shared helper exists for it today, so this is re-derived here too,
  // same as every other Server Action in this app never trusting a
  // client-passed flag for an authorization decision.
  const isSuperUser = (profile?.is_admin ?? false) || (profile?.current_rank ?? 0) > 5;

  return { user, isSuperUser };
}

export type AssignableMember = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  current_rank: number;
  is_mit: boolean;
  mobile_number: string | null;
  car_details: string | null;
};

export type SearchMembersResult =
  | { status: "success"; results: AssignableMember[] }
  | { status: "error"; message: string };

export async function searchAssignableMembers(
  driveId: string,
  query: string,
): Promise<SearchMembersResult> {
  const supabase = await createClient();
  const { user, isSuperUser } = await requireSuperUser(supabase);

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isSuperUser) {
    return { status: "error", message: "Only Super Users can assign members to slots." };
  }

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return { status: "success", results: [] };
  }

  const PROFILE_FIELDS =
    "id, username, full_name, avatar_url, current_rank, is_mit, mobile_number, car_details";

  // Two separate ilike queries instead of a single `.or("username.ilike.%q%,...")`
  // filter string — interpolating raw search input into one PostgREST filter
  // expression breaks/misparses on a comma or parenthesis typed into the box.
  const [usernameMatches, nameMatches, registered] = await Promise.all([
    supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .ilike("username", `%${trimmed}%`)
      .eq("is_disabled", false)
      .order("username")
      .limit(8)
      .overrideTypes<AssignableMember[], { merge: false }>(),
    supabase
      .from("profiles")
      .select(PROFILE_FIELDS)
      .ilike("full_name", `%${trimmed}%`)
      .eq("is_disabled", false)
      .order("username")
      .limit(8)
      .overrideTypes<AssignableMember[], { merge: false }>(),
    supabase.from("drive_registrations").select("user_id").eq("drive_id", driveId),
  ]);

  if (usernameMatches.error || nameMatches.error) {
    const searchError = usernameMatches.error ?? nameMatches.error;
    console.error(
      "SERVER ACTION ERROR [searchAssignableMembers]:",
      searchError?.message,
      searchError?.details,
      searchError?.hint,
    );
    return {
      status: "error",
      message: `Couldn't search members: ${searchError?.message}`,
    };
  }

  const alreadyRegistered = new Set((registered.data ?? []).map((r) => r.user_id));

  const merged = new Map<string, AssignableMember>();
  for (const member of [...(usernameMatches.data ?? []), ...(nameMatches.data ?? [])]) {
    if (!alreadyRegistered.has(member.id)) {
      merged.set(member.id, member);
    }
  }

  return {
    status: "success",
    results: Array.from(merged.values())
      .sort((a, b) => a.username.localeCompare(b.username))
      .slice(0, 8),
  };
}

export type AssignSlotState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

type RoleCheckResult =
  | {
      ok: true;
      memberName: string;
      memberMobile: string | null;
      memberCarDetails: string | null;
      memberCurrentRank: number;
      maxDrivers: number;
    }
  | { ok: false; message: string };

/** Shared by both the create and edit actions below — loads the target
 * member + drive and re-validates the requested role against the member's
 * actual rank via `getAvailableRoles`, the same rank/MIT/target-rank-aware
 * eligibility rules the self-service registration form uses. Never trusts
 * anything about eligibility from the client. */
async function loadMemberAndValidateRole(
  supabase: SupabaseServerClient,
  memberId: string,
  driveId: string,
  requestedRole: RegistrationRole,
): Promise<RoleCheckResult> {
  const [{ data: member, error: memberError }, { data: drive, error: driveError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, full_name, current_rank, is_mit, mobile_number, car_details")
        .eq("id", memberId)
        .single(),
      supabase
        .from("drives")
        .select("target_rank, max_drivers, drive_date, allowed_ranks, is_all_levels")
        .eq("id", driveId)
        .single(),
    ]);

  if (memberError || !member) {
    if (memberError) {
      console.error(
        "SERVER ACTION ERROR [loadMemberAndValidateRole → profiles select]:",
        memberError.message,
        memberError.details,
        memberError.hint,
      );
    }
    return {
      ok: false,
      message: memberError
        ? `Couldn't load that member: ${memberError.message}`
        : "Couldn't find that member.",
    };
  }
  if (driveError || !drive) {
    if (driveError) {
      console.error(
        "SERVER ACTION ERROR [loadMemberAndValidateRole → drives select]:",
        driveError.message,
        driveError.details,
        driveError.hint,
      );
    }
    return {
      ok: false,
      message: driveError ? `Couldn't load this drive: ${driveError.message}` : "Couldn't find that drive.",
    };
  }

  const memberName = member.full_name ?? member.username;

  // Historical-record exception: a drive that already happened is a data
  // entry, not a live safety-critical assignment — a member who's since
  // been promoted can still be backdated into their actual role on an old
  // drive. Deliberately scoped to drive_date, not "any Super User" — this
  // is the only path that can reach this function at all is already
  // Super-User-gated, so a blanket bypass here would silently remove rank
  // guardrails (e.g. a Newbie assignable as Lead) from every upcoming and
  // in-progress drive too, not just archived ones.
  const isHistoricalDrive = drive.drive_date < todayIsoDate();

  // Member (rank 0) eligibility is a policy overlay, not part of the rank
  // hierarchy getAvailableRoles encodes — same "only All Levels or a single
  // Newbie-only drive" rule the self-service form enforces. Historical
  // drives already bypass every rank guardrail via ALL_REGISTRATION_ROLES
  // above (an admin backdating any role for any rank on a past drive), so
  // this only applies on the non-historical branch — consistent with that
  // existing bypass rather than a rank-hierarchy exception that stops short
  // of this one policy rule.
  const availableRoles = isHistoricalDrive
    ? ALL_REGISTRATION_ROLES
    : member.current_rank === 0
      ? (await checkMemberEligibleForDrive(
            supabase,
            memberId,
            driveId,
            drive.allowed_ranks,
            drive.is_all_levels,
          ))
        ? (["Driver"] as RegistrationRole[])
        : []
      : getAvailableRoles({
          currentRank: member.current_rank,
          isMit: member.is_mit ?? false,
          targetRank: drive.target_rank,
          allowedRanks: drive.allowed_ranks.map(Number),
          isAllLevels: drive.is_all_levels,
          hasSupervisingMarshal: await hasSupervisingMarshal(supabase, driveId),
        });

  if (!availableRoles.includes(requestedRole)) {
    const eligible = availableRoles.length > 0 ? availableRoles.join(" or ") : "no role";
    return {
      ok: false,
      message: `${memberName}'s rank only qualifies them for ${eligible} on this drive, not '${requestedRole}'.`,
    };
  }

  return {
    ok: true,
    memberName,
    memberMobile: member.mobile_number,
    memberCarDetails: member.car_details,
    memberCurrentRank: member.current_rank,
    maxDrivers: drive.max_drivers,
  };
}

/** Only the mobile number and vehicle/car details sync back to the
 * member's `profiles` row — role and registration timing are per-drive and
 * never touch the profile. Best-effort: a sync failure degrades to a
 * warning appended to the caller's success message rather than failing the
 * registration write that already succeeded. */
async function syncProfileFields(
  supabase: SupabaseServerClient,
  memberId: string,
  submittedMobile: string,
  currentMobile: string | null,
  submittedVehicle: string,
  currentCarDetails: string | null,
): Promise<string> {
  const updates: Record<string, string> = {};
  if (submittedMobile && submittedMobile !== currentMobile) {
    updates.mobile_number = submittedMobile;
  }
  if (submittedVehicle && submittedVehicle !== currentCarDetails) {
    updates.car_details = submittedVehicle;
  }

  if (Object.keys(updates).length === 0) {
    return "";
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", memberId);
  if (error) {
    // This is the call most likely to hit an RLS gap — it's the one place
    // in this file writing to a *different* user's `profiles` row rather
    // than the caller's own, or a per-drive row scoped by drive_id. Logging
    // the real Postgres error (not just a generic warning) is what makes an
    // RLS-policy-violation actually diagnosable instead of silently eaten.
    console.error(
      "SERVER ACTION ERROR [syncProfileFields → profiles update]:",
      error.message,
      error.details,
      error.hint,
    );
    return ` (profile sync failed: ${error.message})`;
  }
  return "";
}

export async function assignMemberToSlot(
  _prevState: AssignSlotState,
  formData: FormData,
): Promise<AssignSlotState> {
  const supabase = await createClient();
  const { user, isSuperUser } = await requireSuperUser(supabase);

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isSuperUser) {
    return { status: "error", message: "Only Super Users can assign members to slots." };
  }

  const driveId = String(formData.get("driveId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const requestedRole = String(formData.get("role") ?? "") as RegistrationRole;
  const mobileNumber = String(formData.get("mobileNumber") ?? "").trim();
  const vehicleDetails = String(formData.get("vehicleDetails") ?? "").trim();

  if (!driveId || !memberId) {
    return { status: "error", message: "Missing drive or member." };
  }

  // This is the only path that can set disclaimer_accepted: true below —
  // mirrors registerForDrive's own invariant (a real acceptance, never a
  // default), just attested by the admin on the member's behalf instead of
  // the member ticking it themselves.
  if (formData.get("attested") !== "on") {
    return {
      status: "error",
      message: "You must confirm this member accepted the waiver before saving.",
    };
  }

  const check = await loadMemberAndValidateRole(supabase, memberId, driveId, requestedRole);
  if (!check.ok) {
    return { status: "error", message: check.message };
  }

  if (requestedRole === "Driver") {
    const { count, error: countError } = await supabase
      .from("drive_registrations")
      .select("id", { count: "exact", head: true })
      .eq("drive_id", driveId)
      .eq("role", "Driver");

    if (countError) {
      console.error(
        "SERVER ACTION ERROR [driver-count check]:",
        countError.message,
        countError.details,
        countError.hint,
      );
      return {
        status: "error",
        message: `Couldn't check available slots: ${countError.message}`,
      };
    }
    if ((count ?? 0) >= check.maxDrivers) {
      return { status: "error", message: "This drive's driver slots are full." };
    }
  }

  const { error: insertError } = await supabase.from("drive_registrations").insert({
    drive_id: driveId,
    user_id: memberId,
    role: requestedRole,
    vehicle_details: vehicleDetails || null,
    disclaimer_accepted: true,
    driver_rank: requestedRole === "Driver" ? rankNameFromLevel(check.memberCurrentRank) : null,
  });

  if (insertError) {
    console.error(
      "SERVER ACTION ERROR [assignMemberToSlot → drive_registrations insert]:",
      insertError.code,
      insertError.message,
      insertError.details,
      insertError.hint,
    );
    return {
      status: "error",
      message:
        insertError.code === "23505"
          ? `${check.memberName} is already registered for this drive.`
          : `Couldn't save this assignment: ${insertError.message}`,
    };
  }

  const syncWarning = await syncProfileFields(
    supabase,
    memberId,
    mobileNumber,
    check.memberMobile,
    vehicleDetails,
    check.memberCarDetails,
  );

  // Best-effort audit trail, same shape/spirit as unregisterFromDrive's —
  // the assignment itself already succeeded, so a logging failure here
  // shouldn't be surfaced as a failed request. This row is the
  // accountability record for who attested the waiver on the member's
  // behalf, and when.
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "ADMIN_ASSIGN_DRIVE_SLOT",
    details: { drive_id: driveId, assigned_user_id: memberId, role: requestedRole },
  });
  if (auditError) {
    console.error("Failed to write audit log for ADMIN_ASSIGN_DRIVE_SLOT", auditError);
  }

  revalidatePath(`/drives/${driveId}`);

  return {
    status: "success",
    message: `${check.memberName} assigned as ${requestedRole}.${syncWarning}`,
  };
}

/** Edits an *existing* drive_registrations row — role, and vehicle/contact
 * details. No attestation is collected or checked here: the member's
 * disclaimer_accepted value already reflects their original registration
 * (self-service or a prior admin attestation) and this path never changes
 * it either way. */
export async function updateAssignedMember(
  _prevState: AssignSlotState,
  formData: FormData,
): Promise<AssignSlotState> {
  const supabase = await createClient();
  const { user, isSuperUser } = await requireSuperUser(supabase);

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isSuperUser) {
    return { status: "error", message: "Only Super Users can edit drive assignments." };
  }

  const registrationId = String(formData.get("registrationId") ?? "").trim();
  const driveId = String(formData.get("driveId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim();
  const requestedRole = String(formData.get("role") ?? "") as RegistrationRole;
  const mobileNumber = String(formData.get("mobileNumber") ?? "").trim();
  const vehicleDetails = String(formData.get("vehicleDetails") ?? "").trim();

  if (!registrationId || !driveId || !memberId) {
    return { status: "error", message: "Missing registration, drive, or member." };
  }

  const { data: currentRegistration, error: currentError } = await supabase
    .from("drive_registrations")
    .select("role")
    .eq("id", registrationId)
    .single();

  if (currentError || !currentRegistration) {
    if (currentError) {
      console.error(
        "SERVER ACTION ERROR [updateAssignedMember → drive_registrations select]:",
        currentError.message,
        currentError.details,
        currentError.hint,
      );
    }
    return {
      status: "error",
      message: currentError
        ? `Couldn't load that registration: ${currentError.message}`
        : "Couldn't find that registration.",
    };
  }

  const check = await loadMemberAndValidateRole(supabase, memberId, driveId, requestedRole);
  if (!check.ok) {
    return { status: "error", message: check.message };
  }

  // Only re-check capacity when this edit is actually moving someone INTO
  // Driver from a different role — already-Driver-staying-Driver doesn't
  // need re-counting, and moving out of Driver never needs it either.
  if (requestedRole === "Driver" && currentRegistration.role !== "Driver") {
    const { count, error: countError } = await supabase
      .from("drive_registrations")
      .select("id", { count: "exact", head: true })
      .eq("drive_id", driveId)
      .eq("role", "Driver");

    if (countError) {
      console.error(
        "SERVER ACTION ERROR [driver-count check]:",
        countError.message,
        countError.details,
        countError.hint,
      );
      return {
        status: "error",
        message: `Couldn't check available slots: ${countError.message}`,
      };
    }
    if ((count ?? 0) >= check.maxDrivers) {
      return { status: "error", message: "This drive's driver slots are full." };
    }
  }

  const { error: updateError } = await supabase
    .from("drive_registrations")
    .update({
      role: requestedRole,
      vehicle_details: vehicleDetails || null,
      // Only (re)written when the row's role becomes Driver — left
      // untouched (key omitted, not nulled) when it stays/becomes
      // non-Driver, since an unused value on a Lead/Support row is
      // harmless and clearing it would lose the historical snapshot for
      // no reason.
      ...(requestedRole === "Driver"
        ? { driver_rank: rankNameFromLevel(check.memberCurrentRank) }
        : {}),
    })
    .eq("id", registrationId);

  if (updateError) {
    console.error(
      "SERVER ACTION ERROR [updateAssignedMember → drive_registrations update]:",
      updateError.message,
      updateError.details,
      updateError.hint,
    );
    return {
      status: "error",
      message: `Couldn't save these changes: ${updateError.message}`,
    };
  }

  const syncWarning = await syncProfileFields(
    supabase,
    memberId,
    mobileNumber,
    check.memberMobile,
    vehicleDetails,
    check.memberCarDetails,
  );

  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "ADMIN_UPDATE_DRIVE_REGISTRATION",
    details: {
      drive_id: driveId,
      registration_id: registrationId,
      member_id: memberId,
      previous_role: currentRegistration.role,
      new_role: requestedRole,
    },
  });
  if (auditError) {
    console.error("Failed to write audit log for ADMIN_UPDATE_DRIVE_REGISTRATION", auditError);
  }

  revalidatePath(`/drives/${driveId}`);

  return {
    status: "success",
    message: `${check.memberName} updated to ${requestedRole}.${syncWarning}`,
  };
}
