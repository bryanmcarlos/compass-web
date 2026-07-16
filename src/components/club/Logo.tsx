"use client";

import { CLUB_CONFIG } from "@/lib/constants";
import { useThemeSettings } from "./ThemeSettingsProvider";

/**
 * "auto" swaps ink color with the site's light/dark theme (for use on
 * off-white/charcoal surfaces, e.g. the sidebar). "light"/"dark" pin a
 * specific ink regardless of theme, for use on a fixed-color surface like
 * the forest-green dashboard hero, where the background never changes.
 */
export function Logo({
  variant = "auto",
  className = "h-8 w-auto",
}: {
  variant?: "auto" | "light" | "dark";
  className?: string;
}) {
  const { logoUrl: dynamicLogoUrl } = useThemeSettings();
  // The Super Admin-uploaded logo (app_settings.logo_url) wins first, then
  // the static CLUB_CONFIG override (for a white-labeled deployment with no
  // admin panel in play), then the bundled default mark.
  const logoUrl = dynamicLogoUrl ?? CLUB_CONFIG.metadata.logoUrl;

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- admin/club-supplied URL, no fixed remote domain to allowlist
      <img src={logoUrl} alt={CLUB_CONFIG.metadata.shortName} className={className} />
    );
  }

  if (variant === "light") {
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size local SVG mark, next/image's optimization pipeline buys nothing here
    return <img src="/logo-light.svg" alt={CLUB_CONFIG.metadata.shortName} className={className} />;
  }
  if (variant === "dark") {
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size local SVG mark, next/image's optimization pipeline buys nothing here
    return <img src="/logo-dark.svg" alt={CLUB_CONFIG.metadata.shortName} className={className} />;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local SVG mark, next/image's optimization pipeline buys nothing here */}
      <img
        src="/logo-light.svg"
        alt={CLUB_CONFIG.metadata.shortName}
        className={`${className} dark:hidden`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size local SVG mark, next/image's optimization pipeline buys nothing here */}
      <img
        src="/logo-dark.svg"
        alt={CLUB_CONFIG.metadata.shortName}
        className={`hidden ${className} dark:block`}
      />
    </>
  );
}
