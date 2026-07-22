// Shared by drive_notes and trip_reports — both are raw HTML pasted out of
// the same forum WYSIWYG editor, and entities survive the scrape as literal
// text (e.g. "Rookie &amp; Newbie") rather than the character they
// represent. rehype-raw decodes entities that sit *inside* a raw HTML tag
// it parses, but not ones sitting in plain text between tags, so those
// still need decoding before the markdown/HTML pipeline sees them. Limited
// to the entities actually observed in the live data rather than a
// general-purpose decoder.
//
// &lt; is deliberately excluded, even though the others are safe to decode
// before HTML parsing — turning it back into a literal "<" ahead of
// rehype-raw risks it being misread as the start of a real tag. It isn't
// present in either live data set anyway.
const HTML_ENTITIES: [RegExp, string][] = [
  [/&amp;/g, "&"],
  [/&gt;/g, ">"],
  [/&nbsp;/g, " "],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
];

export function decodeForumHtmlEntities(text: string): string {
  let out = text;
  for (const [entity, char] of HTML_ENTITIES) {
    out = out.replace(entity, char);
  }
  return out;
}
