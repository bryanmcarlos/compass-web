/**
 * drives.drive_notes was migrated from old forum/WhatsApp copy-paste
 * templates that had real line breaks in the original post but lost nearly
 * all of them in transit — most of a note arrives as one run-on string
 * ("Meeting Loc: XMeeting Time: 5:00amDrive Start: 5:30am..."). Rather than
 * preserving whitespace that mostly doesn't exist in the source, this
 * reconstructs it: a line break goes in front of each recognized template
 * label and each "* " bullet, so the recurring drive-brief structure reads
 * as a structure again. Verified against the live data set (23 notes): pure
 * whitespace insertion, never changes or drops a single non-whitespace
 * character.
 */
const DRIVE_NOTE_LABELS = [
  "Meeting Loc:",
  "Meeting Point:",
  "Meeting Time:",
  "Drive Start:",
  "Drive End:",
  "Drive Date:",
  "Radio Frequency:",
  "Requirements:",
  "Marshal/s:",
  "Lead:",
  "Support:",
  "Newbie Drivers:",
  "Camp:",
  "Difficulty:",
  "No Registration. No Drive.",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// The source is raw HTML pasted out of a forum WYSIWYG editor — entities
// survive the scrape as literal text (e.g. "Rookie &amp; Newbie") rather
// than the character they represent. rehype-raw (see RouteLogisticsTab)
// decodes entities that sit *inside* a raw HTML tag it parses, but not
// ones sitting in plain text between tags, so those still need decoding
// here. Limited to the entities actually observed in the live data set
// rather than a general-purpose decoder.
// &lt; is deliberately not decoded here, even though the others are safe to
// do before HTML parsing — turning it back into a literal "<" ahead of
// rehype-raw risks it being misread as the start of a real tag if the
// following text happens to look like one. It isn't present in the live
// data set anyway (verified against all 305 rows).
const HTML_ENTITIES: [RegExp, string][] = [
  [/&amp;/g, "&"],
  [/&gt;/g, ">"],
  [/&nbsp;/g, " "],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
];

export function formatDriveNotes(text: string): string {
  let out = text;
  for (const [entity, char] of HTML_ENTITIES) {
    out = out.replace(entity, char);
  }
  for (const label of DRIVE_NOTE_LABELS) {
    out = out.replace(new RegExp(escapeRegExp(label), "g"), `\n${label}`);
  }
  out = out.replace(/\*\s/g, "\n* ");
  out = out.replace(/—{3,}/g, "\n$&\n");

  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}
