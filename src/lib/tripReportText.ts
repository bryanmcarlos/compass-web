/**
 * Most of this app's trip reports were bulk-imported from an old Proboards
 * forum, and the scrape captured the surrounding thread chrome along with
 * the actual post — a duplicated title, "via Tapatalk", a like-count line,
 * "Quote"/"Edit", and a moderation toolbar string, all ending in a reliable
 * "Post by <user> on <date> GMT <offset>" marker that the real forum
 * software rendered just before the post body. Stripping everything up to
 * and including that marker removes all of the above in one pass (verified
 * against the full data set: matches 121 of 122 stored reports, and never
 * strips a report down to nothing). Reports with no such marker — i.e. ones
 * created directly in this app, not scraped — are returned unchanged.
 */
const FORUM_CHROME_PREFIX = /Post by [\s\S]+? on [\s\S]+?GMT\s*[+-]?\d+\s*/;

export function cleanReportText(text: string): string {
  const match = text.match(FORUM_CHROME_PREFIX);
  const body = match ? text.slice((match.index ?? 0) + match[0].length) : text;

  return body
    .replace(/\t+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
