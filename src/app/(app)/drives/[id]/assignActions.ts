"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getAvailableRoles, type RegistrationRole } from "@/lib/driveRoles";
import { hasSupervisingMarshal } from "./actions";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
    return { status: "error", message: "Couldn't search members right now. Please try again." };
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

  const [{ data: member, error: memberError }, { data: drive, error: driveError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("username, full_name, current_rank, is_mit, mobile_number")
        .eq("id", memberId)
        .single(),
      supabase.from("drives").select("target_rank, max_drivers").eq("id", driveId).single(),
    ]);

  if (memberError || !member) {
    return { status: "error", message: "Couldn't find that member." };
  }
  if (driveError || !drive) {
    return { status: "error", message: "Couldn't find that drive." };
  }

  const memberName = member.full_name ?? member.username;

  const availableRoles = getAvailableRoles({
    currentRank: member.current_rank,
    isMit: member.is_mit ?? false,
    targetRank: drive.target_rank,
    hasSupervisingMarshal: await hasSupervisingMarshal(supabase, driveId),
  });

  if (!availableRoles.includes(requestedRole)) {
    return {
      status: "error",
      message: `${memberName}'s rank doesn't qualify for the '${requestedRole}' role on this drive.`,
    };
  }

  if (requestedRole === "Driver") {
    const { count, error: countError } = await supabase
      .from("drive_registrations")
      .select("id", { count: "exact", head: true })
      .eq("drive_id", driveId)
      .eq("role", "Driver");

    if (countError) {
      return { status: "error", message: "Couldn't check available slots. Please try again." };
    }
    if ((count ?? 0) >= drive.max_drivers) {
      return { status: "error", message: "This drive's driver slots are full." };
    }
  }

  const { data: registration, error: insertError } = await supabase
    .from("drive_registrations")
    .insert({
      drive_id: driveId,
      user_id: memberId,
      role: requestedRole,
      vehicle_details: vehicleDetails || null,
      disclaimer_accepted: true,
    })
    .select("id")
    .single();

  if (insertError) {
    return {
      status: "error",
      message:
        insertError.code === "23505"
          ? `${memberName} is already registered for this drive.`
          : "Couldn't save this assignment. Please try again.",
    };
  }

  // Only the phone number syncs back to the profile "master record" — the
  // vehicle field above intentionally only ever lands on this one
  // registration row (drive_registrations.vehicle_details), never on
  // profiles.car_details, so a one-off per-drive tweak can't drift a
  // member's real persistent default.
  let mobileSyncWarning = "";
  if (mobileNumber && mobileNumber !== member.mobile_number) {
    const { error: mobileError } = await supabase
      .from("profiles")
      .update({ mobile_number: mobileNumber })
      .eq("id", memberId);
    if (mobileError) {
      mobileSyncWarning = " (couldn't save the updated mobile number to their profile)";
    }
  }

  // Best-effort audit trail, same shape/spirit as unregisterFromDrive's —
  // the assignment itself already succeeded, so a logging failure here
  // shouldn't be surfaced as a failed request. This row is the
  // accountability record for who attested the waiver on the member's
  // behalf, and when.
  const { error: auditError } = await supabase.from("audit_logs").insert({
    actor_id: user.id,
    action: "ADMIN_ASSIGN_DRIVE_SLOT",
    details: {
      drive_id: driveId,
      assigned_user_id: memberId,
      role: requestedRole,
      drive_registration_id: registration.id,
    },
  });
  if (auditError) {
    console.error("Failed to write audit log for ADMIN_ASSIGN_DRIVE_SLOT", auditError);
  }

  revalidatePath(`/drives/${driveId}`);

  return {
    status: "success",
    message: `${memberName} assigned as ${requestedRole}.${mobileSyncWarning}`,
  };
}
