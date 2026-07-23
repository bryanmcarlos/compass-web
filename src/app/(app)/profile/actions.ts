"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { CLUB_CONFIG, COMPASS_RANKS } from "@/lib/constants";
import { validateImageFile } from "@/lib/imageUpload";

export type RequestPromotionState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export type UpdateProfileState = {
  status: "idle" | "error" | "success";
  message: string | null;
};

export type UploadAvatarState = {
  status: "idle" | "error" | "success";
  message: string | null;
  avatarUrl?: string | null;
};

export async function uploadAvatar(
  _prevState: UploadAvatarState,
  formData: FormData,
): Promise<UploadAvatarState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You need to be signed in to update your avatar.",
    };
  }

  const validation = validateImageFile(formData.get("avatar"));
  if (!validation.ok) {
    return { status: "error", message: validation.message };
  }
  const file = validation.file;

  // A fixed per-user path (rather than a timestamped one) keeps storage tidy
  // via upsert — each re-upload overwrites the last one instead of
  // accumulating orphaned files that nothing ever cleans up.
  const extension = file.type.split("/")[1] ?? "jpg";
  const path = `${user.id}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("SERVER ACTION ERROR [uploadAvatar]:", uploadError);
    return {
      status: "error",
      message: uploadError.message || "Couldn't upload that image. Please try again.",
    };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-busted so <img> tags pick up the new file immediately even though
  // the underlying storage path is unchanged after an upsert overwrite.
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", user.id);

  if (updateError) {
    console.error("SERVER ACTION ERROR [uploadAvatar]:", updateError);
    return {
      status: "error",
      message: "Uploaded, but couldn't save it to your profile. Please try again.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/drives");
  revalidatePath("/trip-reports");

  return { status: "success", message: "Avatar updated.", avatarUrl };
}

// E.164-ish: a leading "+", then 7-14 more digits (no leading zero after the +).
// Accepts either the existing international format (+9715XXXXXXXX) — kept so
// numbers already saved that way still validate — or a local UAE mobile
// number entered directly (05XXXXXXXX, 10 digits).
const MOBILE_NUMBER_PATTERN = /^(?:\+[1-9]\d{6,14}|05\d{8})$/;

/** Strips spaces, dashes, parens, and any other stray characters a user
 * might type, leaving a clean digit string (plus a leading "+" if the
 * number was entered in international format) before it's validated or
 * stored — "056-651 7635" and "+971 56 651 7635" both normalize the same
 * way this produces for their respective formats. */
function sanitizeMobileNumber(raw: string): string {
  const trimmed = raw.trim();
  const digitsOnly = trimmed.replace(/[^\d]/g, "");
  return trimmed.startsWith("+") ? `+${digitsOnly}` : digitsOnly;
}

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You need to be signed in to update your profile.",
    };
  }

  const mobileNumber = sanitizeMobileNumber(String(formData.get("mobileNumber") ?? ""));
  const carDetails = String(formData.get("carDetails") ?? "").trim();

  if (mobileNumber && !MOBILE_NUMBER_PATTERN.test(mobileNumber)) {
    return {
      status: "error",
      message:
        "Enter a valid mobile number — either local (05XXXXXXXX) or international (+9715XXXXXXXX).",
    };
  }
  if (carDetails.length > 100) {
    return {
      status: "error",
      message: "Car details must be 100 characters or fewer.",
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      mobile_number: mobileNumber || null,
      car_details: carDetails || null,
    })
    .eq("id", user.id);

  if (updateError) {
    return {
      status: "error",
      message: "Couldn't save your changes. Please try again.",
    };
  }

  revalidatePath("/profile");

  return { status: "success", message: "Profile updated." };
}

export async function requestPromotion(
  _prevState: RequestPromotionState,
  formData: FormData,
): Promise<RequestPromotionState> {
  const supabase = await createClient();

  // Every Server Function is a public POST endpoint, reachable directly and
  // not just through this button — re-derive rank and eligibility here
  // rather than trusting the `targetRank` the client sent.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      status: "error",
      message: "You need to be signed in to request a promotion.",
    };
  }

  const targetRank = Number(formData.get("targetRank"));
  if (!Number.isInteger(targetRank) || targetRank < 2 || targetRank > 5) {
    return { status: "error", message: "Invalid target rank." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("current_rank")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      status: "error",
      message: "Couldn't load your profile. Please try again.",
    };
  }

  if (targetRank !== profile.current_rank + 1) {
    return {
      status: "error",
      message: "You can only request an examination for the next rank up.",
    };
  }

  const { count, error: countError } = await supabase
    .from("trip_reports")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("is_approved", true);

  if (countError) {
    return {
      status: "error",
      message: "Couldn't verify your approved trip reports. Please try again.",
    };
  }

  const curriculum = COMPASS_RANKS[profile.current_rank as 1 | 2 | 3 | 4 | 5];
  const requiredCount =
    curriculum?.requiredDrives ??
    curriculum?.requiredSupervisedLeads ??
    CLUB_CONFIG.rules.requiredDrivesForPromotion;

  if ((count ?? 0) < requiredCount) {
    return {
      status: "error",
      message: `You need ${requiredCount} approved trip reports to request this examination.`,
    };
  }

  // Re-derive the equipment gate server-side too — never trust that the
  // client-side qualifies check on /profile wasn't bypassed. Only actually
  // constrains ranks whose curriculum lists toolsRequired (today, just
  // Newbie -> Rookie); everything else has an empty requirement and passes.
  const requiredEquipmentCount = curriculum?.toolsRequired?.length ?? 0;
  if (requiredEquipmentCount > 0) {
    const { count: verifiedEquipmentCount, error: equipmentCountError } = await supabase
      .from("equipment_verifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "verified");

    if (equipmentCountError) {
      return {
        status: "error",
        message: "Couldn't verify your equipment checklist. Please try again.",
      };
    }
    if ((verifiedEquipmentCount ?? 0) < requiredEquipmentCount) {
      return {
        status: "error",
        message: `You need all ${requiredEquipmentCount} equipment items verified to request this examination.`,
      };
    }
  }

  const { data: existingRequest, error: existingError } = await supabase
    .from("promotion_requests")
    .select("id")
    .eq("candidate_id", user.id)
    .eq("target_rank", targetRank)
    .eq("status", "Pending")
    .maybeSingle();

  if (existingError) {
    return {
      status: "error",
      message: "Couldn't check for an existing request. Please try again.",
    };
  }
  if (existingRequest) {
    return {
      status: "success",
      message: "You already have a pending promotion request awaiting review.",
    };
  }

  const { error: insertError } = await supabase
    .from("promotion_requests")
    .insert({
      candidate_id: user.id,
      target_rank: targetRank,
      status: "Pending",
    });

  if (insertError) {
    console.error("SERVER ACTION ERROR [requestPromotion]:", insertError);
    return {
      status: "error",
      message:
        insertError.code === "42501"
          ? "Couldn't submit — the database rejected this (missing RLS policy on promotion_requests, not a client bug). Ask an admin to check."
          : "Couldn't submit your promotion request. Please try again.",
    };
  }

  revalidatePath("/profile");

  return {
    status: "success",
    message: "Promotion request submitted! A marshal will review it.",
  };
}
