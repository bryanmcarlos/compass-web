import { CLUB_CONFIG } from "@/lib/constants";

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
  // A marshal-supplied custom logo (set via CLUB_CONFIG for a white-labeled
  // deployment) always wins over the bundled default mark.
  if (CLUB_CONFIG.metadata.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- arbitrary club-supplied URL, no known remote domain to allowlist
      <img
        src={CLUB_CONFIG.metadata.logoUrl}
        alt={CLUB_CONFIG.metadata.shortName}
        className={className}
      />
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
