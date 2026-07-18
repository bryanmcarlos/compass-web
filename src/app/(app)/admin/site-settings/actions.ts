"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { validateImageFile } from "@/lib/imageUpload";
import { FALLBACK_PRIMARY_COLOR } from "@/lib/appSettings";

export type AppSettingsState = {
  status: "idle" | "error" | "success";
  message: string | null;
  updated?: {
    primary_color: string;
    logo_url: string | null;
    default_drive_banner_url: string | null;
  } | null;
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

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

type BrandingUploadResult = { ok: true; url: string } | { ok: false; message: string };

/** Uploads to the 'branding' bucket and returns its public URL. Storage RLS
 * still gates this independently (admins only) — this is the same
 * user-scoped client `requireAdmin()` returned, never a service-role client. */
async function uploadBrandingImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  file: File,
): Promise<BrandingUploadResult> {
  const { error } = await supabase.storage
    .from("branding")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) {
    console.error("SERVER ACTION ERROR [branding upload]:", error);
    return { ok: false, message: "Couldn't upload that image. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("branding").getPublicUrl(path);

  // Cache-busted so <img> tags pick up a replaced file immediately even
  // though an upsert overwrite leaves the storage path unchanged.
  return { ok: true, url: `${publicUrl}?v=${Date.now()}` };
}

export async function updateAppSettings(
  _prevState: AppSettingsState,
  formData: FormData,
): Promise<AppSettingsState> {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in to update site settings." };
  }
  if (!isAdmin) {
    return { status: "error", message: "Only Super Admins can update site settings." };
  }

  const primaryColor = String(formData.get("primaryColor") ?? "").trim() || FALLBACK_PRIMARY_COLOR;
  if (!HEX_COLOR_PATTERN.test(primaryColor)) {
    return { status: "error", message: "Enter a valid hex color, e.g. #E68A00." };
  }

  const fields: Record<string, unknown> = { primary_color: primaryColor };

  const logoEntry = formData.get("logo");
  if (logoEntry instanceof File && logoEntry.size > 0) {
    const validation = validateImageFile(logoEntry);
    if (!validation.ok) {
      return { status: "error", message: validation.message };
    }
    const extension = validation.file.type.split("/")[1] ?? "png";
    const uploaded = await uploadBrandingImage(supabase, `logo.${extension}`, validation.file);
    if (!uploaded.ok) {
      return { status: "error", message: uploaded.message };
    }
    fields.logo_url = uploaded.url;
  }

  const bannerEntry = formData.get("defaultDriveBanner");
  if (bannerEntry instanceof File && bannerEntry.size > 0) {
    const validation = validateImageFile(bannerEntry);
    if (!validation.ok) {
      return { status: "error", message: validation.message };
    }
    const extension = validation.file.type.split("/")[1] ?? "jpg";
    const uploaded = await uploadBrandingImage(
      supabase,
      `default-drive-banner.${extension}`,
      validation.file,
    );
    if (!uploaded.ok) {
      return { status: "error", message: uploaded.message };
    }
    fields.default_drive_banner_url = uploaded.url;
  }

  try {
    const { data: updated, error } = await supabase
      .from("app_settings")
      .update(fields)
      .eq("id", 1)
      .select("primary_color, logo_url, default_drive_banner_url")
      .single();

    if (error) {
      console.error("SERVER ACTION ERROR [updateAppSettings]:", error);
      return { status: "error", message: error.message };
    }

    // The root layout reads app_settings on every request but isn't tied to
    // a specific path — revalidating "/" with type "layout" invalidates that
    // shared root segment (and everything under it), not just the homepage.
    revalidatePath("/", "layout");

    return { status: "success", message: "Settings saved.", updated };
  } catch (err) {
    console.error("SERVER ACTION ERROR [updateAppSettings]:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Couldn't save settings. Please try again.",
    };
  }
}

export type ToggleModerationState = {
  status: "idle" | "error" | "success";
  message: string | null;
  enabled?: boolean;
};

/** A separate, single-purpose action rather than folding this into
 * updateAppSettings — this toggle saves instantly on click, it doesn't wait
 * for a "Save Settings" button alongside unrelated branding fields. */
export async function toggleTripReportModeration(
  enabled: boolean,
): Promise<ToggleModerationState> {
  const { supabase, user, isAdmin } = await requireAdmin();

  if (!user) {
    return { status: "error", message: "You need to be signed in to update site settings." };
  }
  if (!isAdmin) {
    return { status: "error", message: "Only Super Admins can update site settings." };
  }

  const { error } = await supabase
    .from("app_settings")
    .update({ require_trip_report_approval: enabled })
    .eq("id", 1);

  if (error) {
    console.error("SERVER ACTION ERROR [toggleTripReportModeration]:", error);
    return { status: "error", message: error.message };
  }

  revalidatePath("/", "layout");

  return {
    status: "success",
    message: enabled
      ? "Trip report moderation enabled."
      : "Trip report moderation disabled — new reports go live instantly.",
    enabled,
  };
}
