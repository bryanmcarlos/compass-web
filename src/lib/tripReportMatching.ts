/** Shared by the admin-only trip-report/drive linking cleanup tool — both
 * directions (drive -> candidate reports, and unlinked report -> candidate
 * drives) key off the same idea: extract meaningful words from a drive's
 * title, then check how many show up in a report's free text. Reports have
 * no title column of their own (confirmed against the live schema), so the
 * drive's title is always the anchor for "similar keywords," never the
 * other way around. */

export const CLEANUP_DATE_WINDOW_DAYS = 20;

// Rank/role labels, day names, and generic filler that show up in nearly
// every drive title — keeping these would make almost any report "similar"
// to almost any drive. Years are deliberately NOT stripped: two events at
// the same location a year apart is exactly the kind of collision the
// original trip-report migration got wrong by ignoring date proximity, so a
// year is a real, useful signal here, not noise.
const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "drive", "drives",
  "trip", "report", "official", "camp", "camping",
  "tr", "rok", "rookie", "nwb", "newbie", "int", "intermediate",
  "adv", "advanced", "mem", "member", "all", "levels", "level",
  "sun", "mon", "tue", "wed", "thu", "fri", "sat",
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractTitleKeywords(title: string): string[] {
  return Array.from(
    new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
    ),
  );
}

/** Whole-word, case-insensitive count of how many of `keywords` appear in
 * `text` — capped to the first 5000 characters so a very long report body
 * doesn't turn this into an expensive scan. */
export function countKeywordHits(keywords: string[], text: string): number {
  const haystack = text.slice(0, 5000).toLowerCase();
  let hits = 0;
  for (const keyword of keywords) {
    if (new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(haystack)) hits++;
  }
  return hits;
}

export function daysBetween(isoA: string, isoB: string): number {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  return Math.abs(a - b) / (1000 * 60 * 60 * 24);
}

/** Short, tag-stripped preview for an admin scanning a list of candidates —
 * not meant to render as real markdown, just enough text to recognize the
 * report by eye. */
export function previewText(reportText: string, maxLength = 160): string {
  const stripped = reportText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped.length > maxLength ? `${stripped.slice(0, maxLength)}…` : stripped;
}
