export function Avatar({
  name,
  avatarUrl,
  className = "h-10 w-10 text-sm",
  /** CSS custom property carrying a rank's mark color, e.g. "--color-tier-3"
   * (see `CLUB_CONFIG.ranks`). When set, renders a small colored dot over
   * the avatar's corner as an at-a-glance rank cue. */
  rankColorVar,
}: {
  name: string;
  avatarUrl: string | null;
  /** Full literal size + font-size classes, e.g. "h-16 w-16 text-lg". */
  className?: string;
  rankColorVar?: string;
}) {
  const image = avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary member-hosted URL, no known remote domain to allowlist
    <img
      src={avatarUrl}
      alt={name}
      className={`shrink-0 rounded-full border border-sand object-cover ${className}`}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- local static asset, no benefit from next/image here
    <img
      src="/defaults/avatar-placeholder.svg"
      alt={name}
      className={`shrink-0 rounded-full border border-sand object-cover ${className}`}
    />
  );

  if (!rankColorVar) {
    return image;
  }

  return (
    <span className="relative inline-flex shrink-0">
      {image}
      <span
        aria-hidden="true"
        style={{ backgroundColor: `var(${rankColorVar})` }}
        className="absolute right-0 bottom-0 h-1/3 w-1/3 min-h-2 min-w-2 rounded-full border-2 border-off-white"
      />
    </span>
  );
}
