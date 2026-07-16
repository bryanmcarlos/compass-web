import { createClient } from "@supabase/supabase-js";

export type AppSettings = {
  primaryColor: string;
  logoUrl: string | null;
  defaultDriveBannerUrl: string | null;
};

export const FALLBACK_PRIMARY_COLOR = "#E68A00";

/** `app_settings` is a public, singleton, non-personalized row (readable by
 * anyone, writes gated separately by `is_admin` in the Server Action) — this
 * intentionally uses a plain anon-key client with no cookie access rather
 * than the session-bound server client. Root layout renders on every route
 * including the still-staticable "/" and "/login"; touching `cookies()`
 * there would force the whole app dynamic just to read a color. */
export async function getAppSettings(): Promise<AppSettings> {
  const fallback: AppSettings = {
    primaryColor: FALLBACK_PRIMARY_COLOR,
    logoUrl: null,
    defaultDriveBannerUrl: null,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from("app_settings")
      .select("primary_color, logo_url, default_drive_banner_url")
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return fallback;
    }

    return {
      primaryColor: data.primary_color || FALLBACK_PRIMARY_COLOR,
      logoUrl: data.logo_url,
      defaultDriveBannerUrl: data.default_drive_banner_url,
    };
  } catch {
    return fallback;
  }
}
