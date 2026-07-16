/**
 * Automatic "NWB - " / "ROK - " / "INT - " / "ADV - " title prefixing by
 * target rank. Marshal-target (5) drives get no prefix — none was specified.
 * Pure and framework-free so the client (for the live preview and the edit
 * form's clean initial value) and the server (the actual source of truth)
 * share one implementation.
 */

const RANK_PREFIXES: Record<number, string> = {
  1: "NWB",
  2: "ROK",
  3: "INT",
  4: "ADV",
};

const ALL_PREFIXES = Object.values(RANK_PREFIXES);

/** Strips a leading known rank prefix ("NWB - ", etc.), if present. */
export function stripDriveTitlePrefix(title: string): string {
  for (const prefix of ALL_PREFIXES) {
    const marker = `${prefix} - `;
    if (title.startsWith(marker)) {
      return title.slice(marker.length);
    }
  }
  return title;
}

/**
 * Strips any existing known prefix first, then prepends the correct one for
 * `targetRank` — idempotent and stacking-proof by construction, whether
 * called on a fresh title, a resubmitted one, or one carrying a stale prefix
 * from before the target rank was changed on edit.
 */
export function applyDriveTitlePrefix(title: string, targetRank: number): string {
  const base = stripDriveTitlePrefix(title.trim());
  const prefix = RANK_PREFIXES[targetRank];
  return prefix ? `${prefix} - ${base}` : base;
}
