import type { Components } from "react-markdown";

// react-markdown renders bare HTML elements with no classes by default —
// this maps them onto the app's own type scale instead of pulling in a
// typography plugin for what's ultimately a handful of tags.
// react-markdown passes an internal `node` (AST) prop to every custom
// renderer alongside the real DOM props — picking only the specific props
// each element needs (rather than `{...props}`-spreading everything blindly)
// keeps it from leaking onto the actual element as an invalid
// `node="[object Object]"` attribute.
// break-words matters more than it looks like it should here — this app's
// trip reports and drive notes are full of long unbroken tokens (bare URLs,
// concatenated phone-number/coordinate strings from scraped source data)
// that don't contain a space for the browser to wrap on. Without it, one
// long token forces its card wider than its grid/flex track, and that's
// exactly what pushes the whole page into horizontal scroll — not a
// viewport bug, a missing wrap rule on the one place long free text
// actually renders. Shared between TripReportCard and the drive notes
// renderer so both markdown surfaces stay visually consistent.
export const markdownComponents: Components = {
  p: (props) => (
    <p className="mb-3 leading-relaxed break-words last:mb-0">{props.children}</p>
  ),
  strong: (props) => (
    <strong className="font-semibold text-charcoal">{props.children}</strong>
  ),
  ul: (props) => (
    <ul className="mb-3 list-disc pl-5 break-words last:mb-0">{props.children}</ul>
  ),
  ol: (props) => (
    <ol className="mb-3 list-decimal pl-5 break-words last:mb-0">{props.children}</ol>
  ),
  li: (props) => <li className="mb-1 break-words">{props.children}</li>,
  blockquote: (props) => (
    <blockquote className="mb-3 border-l-2 border-sand pl-3 text-charcoal-light/70 italic break-words last:mb-0">
      {props.children}
    </blockquote>
  ),
  a: (props) => (
    <a
      className="font-medium text-forest break-all hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      href={props.href}
    >
      {props.children}
    </a>
  ),
};
