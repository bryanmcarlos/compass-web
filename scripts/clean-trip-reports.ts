/**
 * One-off maintenance script — NOT part of the deployed app, not imported
 * by anything else. Cleans `trip_reports.report_text` from raw forum-scrape
 * noise (ProBoards-style "Post by X on...", moderation toolbar chrome,
 * "N likes this", repeated titles, run-on unbroken field lists) into
 * readable markdown.
 *
 * Deliberately does NOT touch `author_id`. A prior migration already
 * appears to have matched ~94% of rows to real profiles (verified directly
 * against the live DB before writing this) — re-guessing authorship here
 * would risk regressing already-correct attributions for a problem that's
 * mostly already solved. If you want the ~32 uncertain rows re-checked,
 * that should be a separate, human-reviewed pass — not a blind bulk write.
 *
 * There's also no `event_date` / `location` column on `trip_reports` to
 * populate — it relies on `drive_id` -> `drives` for that. This script
 * keeps the original post date as a line of provenance inside the cleaned
 * markdown itself (nowhere else to put it), and does not invent columns.
 *
 * Usage (run from the repo root):
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/clean-trip-reports.ts [flags]
 *
 * Flags:
 *   (none)         dry run — writes a diff report, makes no DB writes
 *   --apply        actually updates report_text in Supabase
 *   --limit=20     only process the first N rows (good for spot-checking)
 *   --out=path     diff report location (default ./trip-report-cleanup-report.json)
 *   --verbose      also print each row's before/after to the console
 *
 * ALWAYS run without --apply first and read the report. A full backup of
 * every row's original report_text is written to ./trip-report-backups/
 * before any write, on every run (dry or applied).
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY (the Supabase dashboard's service_role
 * key, not the anon key) — this bulk-updates rows across every member's
 * trip reports, which normal RLS won't allow a single user's session to do.
 * Never commit that key; export it in your shell for this one run instead.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.\n" +
      "This needs the service-role key specifically — it bulk-updates rows across every\n" +
      "member's trip reports, which the anon key's RLS policies won't permit.",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- CLI args ----
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const VERBOSE = args.includes("--verbose");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;
const outArg = args.find((a) => a.startsWith("--out="));
const OUT_PATH = outArg ? outArg.split("=")[1] : "./trip-report-cleanup-report.json";

// ---- Cleaning ----

// Recognized field labels inside the report body — tuned against the
// sampled rows, not exhaustively verified across all 121. Extend this list
// after reading the diff report if other rows use different wording.
const FIELD_LABELS = [
  "Drive Date",
  "Drive Difficulty",
  "DETAILS",
  "Date",
  "Meeting Loc",
  "Meeting Location",
  "Meeting Point",
  "Meeting Time",
  "Moving Time",
  "Drive Start",
  "Drive End",
  "Google Maps",
  "Deflation Point",
  "Location",
  "Introduction",
  "Learnings",
  "Challenges",
  "Need to improve",
  "Tools",
  "Recovery",
  "Regards",
];

type CleanResult = {
  cleaned: string;
  postedBy: string | null;
  postedDate: string | null;
};

function cleanReportText(raw: string): CleanResult {
  let text = raw.replace(/\r\n/g, "\n");

  // 1. Capture the "Post by X on <date>" attribution line. author_id
  //    already carries the real relationship (left untouched by this
  //    script) — this is read only for the date, and so the line itself
  //    can be cut from the body as noise.
  //    Non-greedy `.+?` for the username, not `\S+` — some scraped forum
  //    handles contain spaces (e.g. "Wendell 0IIIIIII0", matching the real
  //    legacy_wendell0iiiiiii0 profile), and `\S+` silently fails to match
  //    the whole line whenever that happens, leaving the raw noise in place.
  const postedMatch = text.match(/Post by (.+?) on ([^\n]+)/);
  const postedBy = postedMatch?.[1]?.replace(/[.,:;]+$/, "") ?? null;
  const postedDate = postedMatch?.[2]?.trim() ?? null;

  if (postedMatch) {
    // Cut everything up through and including that line — title header,
    // repeated title, timestamp, "X likes this", Quote/Edit, and the
    // moderation-toolbar blob all live before it in every sampled row.
    const cutIndex = text.indexOf(postedMatch[0]) + postedMatch[0].length;
    text = text.slice(cutIndex);
  } else {
    // No attribution line found — some rows may not follow the template.
    // Fall back to stripping the known noise blocks individually.
    text = text
      .replace(/Select Post[\s\S]*?Back to Top/g, "")
      .replace(/^\*\*Title:.*\*\*\s*/m, "")
      .replace(/Quote\s*Edit\s*/g, "");
  }

  // 2. Strip a leading repeat of the title, if the body restates it
  //    verbatim before the real content starts (true in every sampled row).
  const titleMatch = raw.match(/\*\*Title:\s*(.+?)\s*\*\*/);
  if (titleMatch) {
    const title = titleMatch[1].trim();
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^\\s*${escapedTitle}\\s*`, "i"), "");
  }

  // 3. Insert a line break + markdown bold before each recognized field
  //    label — the scrape collapsed "Drive Date: XMeeting Loc: Y" into one
  //    run-on line with no separators at all. Deliberately no \b before the
  //    label: the run-on text often glues the previous value directly onto
  //    the next label with no punctuation between them at all (e.g.
  //    "7:00 amDrive Start:"), which is two adjacent word characters and
  //    so never satisfies a \b boundary — matching on "label immediately
  //    followed by a colon" without that anchor is what actually catches
  //    those cases, at the small cost of also firing if some unrelated word
  //    happened to end in the same text right before a colon (rare).
  //
  //    This MUST be one combined regex.replace, not a loop that mutates
  //    `text` label-by-label: with overlapping labels like "Drive Date" and
  //    "Date", a loop re-scans the *already-bolded* output of an earlier
  //    label on a later iteration and corrupts it (e.g. "Date:" inside the
  //    just-inserted "**Drive Date:**" matching again as its own label,
  //    producing "**Drive\n\n**Date:****"). A single alternation pattern
  //    only ever scans the original string once, so that can't happen —
  //    and sorting longest-first makes the engine prefer "Drive Date" over
  //    "Date" wherever both could match the same position.
  const sortedLabels = [...FIELD_LABELS].sort((a, b) => b.length - a.length);
  const labelPattern = new RegExp(`(${sortedLabels.join("|")}):`, "g");
  text = text.replace(labelPattern, "\n\n**$1:**");

  // 4. Break "-item" bullet runs (no space after the dash, used as a list
  //    marker in the sampled rows) onto their own lines. This can also fire
  //    on a genuine mid-word hyphen with no following space — rare, and
  //    visible in the diff report before you apply anything.
  text = text.replace(/-(?=\S)/g, "\n- ");

  // 5. Collapse the leftover tab-indented whitespace and repeated blank
  //    lines from the scrape into single blank-line separators.
  text = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, arr) => !(line === "" && arr[i - 1] === ""))
    .join("\n")
    .trim();

  const cleaned = postedDate ? `> *Originally posted: ${postedDate}*\n\n${text}` : text;

  return { cleaned, postedBy, postedDate };
}

// ---- Main ----

type Row = { id: string; report_text: string };

async function main() {
  let query = supabase.from("trip_reports").select("id, report_text").order("created_at");
  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const { data: rows, error } = await query.overrideTypes<Row[], { merge: false }>();
  if (error || !rows) {
    console.error("Couldn't fetch trip_reports:", error);
    process.exit(1);
  }

  console.log(`Fetched ${rows.length} row(s).`);

  // Always back up the untouched originals before doing anything else,
  // dry run or not — cheap, and the only real safety net against a bad
  // heuristic clobbering real content with no way back.
  mkdirSync("./trip-report-backups", { recursive: true });
  const backupPath = join("./trip-report-backups", `${Date.now()}.json`);
  writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`Backed up original report_text for ${rows.length} row(s) to ${backupPath}`);

  const diffs = rows.map((row) => {
    const result = cleanReportText(row.report_text);
    return {
      id: row.id,
      before: row.report_text,
      after: result.cleaned,
      postedBy: result.postedBy,
      postedDate: result.postedDate,
      changed: result.cleaned !== row.report_text,
    };
  });

  writeFileSync(OUT_PATH, JSON.stringify(diffs, null, 2));
  console.log(`Wrote diff report for ${diffs.length} row(s) to ${OUT_PATH}`);
  console.log(`${diffs.filter((d) => d.changed).length} row(s) would change.`);

  if (VERBOSE) {
    for (const diff of diffs) {
      console.log(`\n--- ${diff.id} (posted by ${diff.postedBy ?? "unknown"}) ---`);
      console.log("BEFORE:\n", diff.before);
      console.log("AFTER:\n", diff.after);
    }
  }

  if (!APPLY) {
    console.log(
      "\nDry run only — no rows were updated. Review the report, then re-run with --apply.",
    );
    return;
  }

  console.log("\nApplying updates...");
  let succeeded = 0;
  let failed = 0;
  for (const diff of diffs) {
    if (!diff.changed) continue;
    const { error: updateError } = await supabase
      .from("trip_reports")
      .update({ report_text: diff.after })
      .eq("id", diff.id);
    if (updateError) {
      console.error(`  FAILED ${diff.id}:`, updateError.message);
      failed++;
    } else {
      succeeded++;
    }
  }
  console.log(`\nDone. ${succeeded} row(s) updated, ${failed} failed.`);
}

main();
