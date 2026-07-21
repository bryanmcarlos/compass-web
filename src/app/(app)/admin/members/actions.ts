"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type MemberActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return { supabase, user, isAdmin: profile?.is_admin ?? false };
}

const VALID_RANKS = new Set([1, 2, 3, 4, 5]);

export async function updateMemberRank(
  memberId: string,
  targetRank: number,
): Promise<MemberActionState> {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isAdmin) {
    return { status: "error", message: "Only Super Admins can change member ranks." };
  }
  if (!VALID_RANKS.has(targetRank)) {
    return { status: "error", message: "Invalid rank." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ current_rank: targetRank })
    .eq("id", memberId);

  if (error) {
    console.error("SERVER ACTION ERROR [updateMemberRank]:", error);
    return { status: "error", message: "Couldn't update this member's rank. Please try again." };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: "Rank updated." };
}

export async function toggleMemberDisabled(
  memberId: string,
  isDisabled: boolean,
): Promise<MemberActionState> {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isAdmin) {
    return { status: "error", message: "Only Super Admins can enable or disable accounts." };
  }
  if (memberId === user.id) {
    return { status: "error", message: "You can't disable your own account." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_disabled: isDisabled })
    .eq("id", memberId);

  if (error) {
    console.error("SERVER ACTION ERROR [toggleMemberDisabled]:", error);
    return {
      status: "error",
      message: "Couldn't update this member's account access. Please try again.",
    };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: isDisabled ? "Account disabled." : "Account re-enabled." };
}

export async function toggleMemberApproval(
  memberId: string,
  isApproved: boolean,
): Promise<MemberActionState> {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isAdmin) {
    return { status: "error", message: "Only Super Admins can approve members." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ is_approved: isApproved })
    .eq("id", memberId);

  if (error) {
    console.error("SERVER ACTION ERROR [toggleMemberApproval]:", error);
    return {
      status: "error",
      message: "Couldn't update this member's approval status. Please try again.",
    };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: isApproved ? "Member approved." : "Approval revoked." };
}

export async function updateMemberFields(
  _prevState: MemberActionState,
  formData: FormData,
): Promise<MemberActionState> {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in." };
  }
  if (!isAdmin) {
    return { status: "error", message: "Only Super Admins can edit member profiles." };
  }

  const memberId = String(formData.get("memberId") ?? "").trim();
  if (!memberId) {
    return { status: "error", message: "Missing member." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const mobileNumber = String(formData.get("mobileNumber") ?? "").trim();
  const carDetails = String(formData.get("carDetails") ?? "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName || null,
      mobile_number: mobileNumber || null,
      car_details: carDetails || null,
    })
    .eq("id", memberId);

  if (error) {
    console.error("SERVER ACTION ERROR [updateMemberFields]:", error);
    return { status: "error", message: "Couldn't save these changes. Please try again." };
  }

  revalidatePath("/admin/members");
  return { status: "success", message: "Profile updated." };
}
