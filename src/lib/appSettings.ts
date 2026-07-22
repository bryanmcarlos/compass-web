import { createClient } from "@supabase/supabase-js";
import { DEFAULT_BROADCAST_TEMPLATE } from "@/lib/broadcastTemplate";

export type AppSettings = {
  primaryColor: string;
  logoUrl: string | null;
  defaultDriveBannerUrl: string | null;
  requireTripReportApproval: boolean;
  broadcastMessageTemplate: string;
};

export const FALLBACK_PRIMARY_COLOR = "#FFBF2D";

/** `app_settings` is a public, singleton, non-personalized row (readable by
 * anyone, writes gated separately by `is_admin` in the Server Action) — this
 * intentionally uses a plain anon-key client with no cookie access rather
 * than the session-bound server client. Root layout renders on every route
 * including the still-staticable "/" and "/login"; touching `cookies()`
 * there would force the whole app dynamic just to read a color. */
export async function getAppSettings(): Promise<AppSettings> {
  // Moderation defaults ON when unknown (fetch failure, column not migrated
  // yet) — the conservative fallback, and what every submission already did
  // before this flag existed.
  const fallback: AppSettings = {
    primaryColor: FALLBACK_PRIMARY_COLOR,
    logoUrl: null,
    defaultDriveBannerUrl: null,
    requireTripReportApproval: true,
    broadcastMessageTemplate: DEFAULT_BROADCAST_TEMPLATE,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data, error } = await supabase
      .from("app_settings")
      .select(
        "primary_color, logo_url, default_drive_banner_url, require_trip_report_approval, broadcast_message_template",
      )
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return fallback;
    }

    return {
      primaryColor: data.primary_color || FALLBACK_PRIMARY_COLOR,
      logoUrl: data.logo_url,
      defaultDriveBannerUrl: data.default_drive_banner_url,
      requireTripReportApproval: data.require_trip_report_approval ?? true,
      broadcastMessageTemplate: data.broadcast_message_template || DEFAULT_BROADCAST_TEMPLATE,
    };
  } catch {
    return fallback;
  }
}
