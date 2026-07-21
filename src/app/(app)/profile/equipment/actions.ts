"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { validateImageFile } from "@/lib/imageUpload";
import { cloudinaryConfigured, uploadBufferToCloudinary } from "@/lib/cloudinary";
import { MANDATORY_EQUIPMENT } from "@/lib/constants";

export type UploadEquipmentProofState = {
  status: "idle" | "error" | "success";
  message: string | null;
  url?: string | null;
};

/** One call per item photo — mirrors uploadImageToCloudinary in
 * trip-reports/actions.ts, just against a separate Cloudinary folder so
 * gear proof photos don't mix with trip report photos. */
export async function uploadEquipmentProof(formData: FormData): Promise<UploadEquipmentProofState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to upload proof." };
  }

  const validation = validateImageFile(formData.get("file"));
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }

  if (!cloudinaryConfigured()) {
    console.error(
      "SERVER ACTION ERROR [uploadEquipmentProof]: CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not set.",
    );
    return {
      status: "error",
      message: "Photo uploads aren't configured on this server yet — ask an admin to set up Cloudinary.",
    };
  }

  const buffer = Buffer.from(await validation.file.arrayBuffer());
  const result = await uploadBufferToCloudinary(buffer, "compass_equipment_proofs");

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

export type SubmitEquipmentProofState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

/** Records an already-uploaded proof photo against one of the 15 mandatory
 * items — called right after uploadEquipmentProof resolves, not through a
 * native form submit, since each item card uploads independently. Always
 * resets status back to "uploaded" even on a re-upload of a previously
 * verified item — a changed photo needs a marshal's eyes on it again. */
export async function submitEquipmentProof(
  itemName: string,
  proofUrl: string,
): Promise<SubmitEquipmentProofState> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { status: "error", message: "You need to be signed in to submit proof." };
  }

  if (!MANDATORY_EQUIPMENT.includes(itemName)) {
    return { status: "error", message: "That isn't one of the mandatory equipment items." };
  }

  let proofUrlObject: URL;
  try {
    proofUrlObject = new URL(proofUrl);
  } catch {
    return { status: "error", message: "Invalid proof URL." };
  }
  if (proofUrlObject.protocol !== "http:" && proofUrlObject.protocol !== "https:") {
    return { status: "error", message: "Invalid proof URL." };
  }

  const { error } = await supabase.from("equipment_verifications").upsert(
    {
      user_id: user.id,
      item_name: itemName,
      proof_url: proofUrl,
      status: "uploaded",
      verified_by: null,
      verified_at: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,item_name" },
  );

  if (error) {
    console.error("SERVER ACTION ERROR [submitEquipmentProof]:", error);
    return { status: "error", message: "Couldn't save your proof. Please try again." };
  }

  revalidatePath("/profile/equipment");
  revalidatePath("/profile");
  revalidatePath("/equipment-review");

  return { status: "success", message: "Proof submitted — awaiting marshal review." };
}
