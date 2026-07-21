"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

export type EquipmentReviewActionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

async function requireReviewer(supabase: Awaited<ReturnType<typeof createClient>>) {
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
    return { user: null as null, error: "Only Marshals and Admins can verify equipment." };
  }

  return { user, error: null as null };
}

export async function verifyEquipmentItem(
  candidateId: string,
  itemName: string,
): Promise<EquipmentReviewActionState> {
  const supabase = await createClient();
  const { user, error: authError } = await requireReviewer(supabase);
  if (authError || !user) {
    return { status: "error", message: authError };
  }

  const { error } = await supabase
    .from("equipment_verifications")
    .update({
      status: "verified",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", candidateId)
    .eq("item_name", itemName);

  if (error) {
    console.error("SERVER ACTION ERROR [verifyEquipmentItem]:", error);
    return { status: "error", message: "Couldn't verify that item. Please try again." };
  }

  revalidatePath("/equipment-review");
  revalidatePath("/profile/equipment");
  revalidatePath("/profile");

  return { status: "success", message: "Item verified." };
}

/** Verifies every item this member has already submitted proof for — never
 * verifies an item with no proof at all, so this is a bulk-approve
 * convenience over the per-item button, not a bypass of the evidence
 * requirement. */
export async function masterSignOffEquipment(candidateId: string): Promise<EquipmentReviewActionState> {
  const supabase = await createClient();
  const { user, error: authError } = await requireReviewer(supabase);
  if (authError || !user) {
    return { status: "error", message: authError };
  }

  const { data: rows, error: fetchError } = await supabase
    .from("equipment_verifications")
    .select("item_name")
    .eq("user_id", candidateId)
    .eq("status", "uploaded");

  if (fetchError) {
    console.error("SERVER ACTION ERROR [masterSignOffEquipment]:", fetchError);
    return { status: "error", message: "Couldn't load this member's items. Please try again." };
  }

  const uploadedCount = (rows ?? []).length;
  if (uploadedCount === 0) {
    return { status: "error", message: "Nothing left to verify for this member." };
  }

  const { error: updateError } = await supabase
    .from("equipment_verifications")
    .update({
      status: "verified",
      verified_by: user.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", candidateId)
    .eq("status", "uploaded");

  if (updateError) {
    console.error("SERVER ACTION ERROR [masterSignOffEquipment]:", updateError);
    return { status: "error", message: "Couldn't sign off this member's equipment. Please try again." };
  }

  revalidatePath("/equipment-review");
  revalidatePath("/profile/equipment");
  revalidatePath("/profile");

  return {
    status: "success",
    message: `Signed off ${uploadedCount} equipment item${uploadedCount === 1 ? "" : "s"}.`,
  };
}
