import { defaultSchema } from "hast-util-sanitize";
import type { Schema } from "hast-util-sanitize";

/** drive_notes is raw HTML pasted out of the original forum's rich-text
 * editor (verified against all 305 live rows: <a>, <b>, <br>, <div>, <em>,
 * <font>, <hr>, <i>, <img>, <li>, <ol>, <p>, <s>, <span>, <strong>, <u>,
 * <ul> all actually occur) — not markdown-with-occasional-HTML. rehype-raw
 * parses it as real HTML instead of literal text; this schema is what
 * rehype-sanitize checks it against afterward, since raw HTML from any
 * stored/scraped source should never render un-sanitized. Only <font>
 * (deprecated, forum WYSIWYG leftover) and <img> aren't in hast-util-
 * sanitize's default allowlist — every other observed tag already is. */
export const driveNotesSanitizeSchema: Schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "font", "img"],
  attributes: {
    ...defaultSchema.attributes,
    font: ["color", "size", "face"],
    img: ["src", "alt", "title", "width", "height"],
  },
};
