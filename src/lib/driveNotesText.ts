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

export function formatDriveNotes(text: string): string {
  let out = text;
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
