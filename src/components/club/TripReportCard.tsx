import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import { BadgeCheck, HourglassIcon, MapPin, Route } from "lucide-react";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";
import { DeleteReportButton } from "./DeleteReportButton";
import { formatDate } from "@/lib/format";
import { cleanReportText } from "@/lib/tripReportText";

export type TripReportCardData = {
  id: string;
  report_text: string;
  photos: string[] | null;
  created_at: string;
  is_approved: boolean;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    current_rank: number;
  } | null;
  drive?: {
    title: string;
    drive_date: string;
    location: string;
  } | null;
};

function formatRelativeTime(iso: string) {
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 24 * 365],
    ["month", 60 * 24 * 30],
    ["week", 60 * 24 * 7],
    ["day", 60 * 24],
    ["hour", 60],
    ["minute", 1],
  ];

  for (const [unit, minutesInUnit] of divisions) {
    if (unit === "minute" || Math.abs(diffMinutes) >= minutesInUnit) {
      return rtf.format(Math.round(diffMinutes / minutesInUnit), unit);
    }
  }
  return rtf.format(diffMinutes, "minute");
}

function PhotoGallery({ photos, reportAuthor }: { photos: string[]; reportAuthor: string }) {
  const visible = photos.slice(0, 4);
  const extra = photos.length - visible.length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {visible.map((url, i) => (
        <div
          key={url}
          className="relative aspect-square overflow-hidden rounded-lg border border-sand bg-sand-light"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary member-hosted URLs (Cloudinary/Imgur), no known remote domain to allowlist */}
          <img
            src={url}
            alt={`Photo ${i + 1} from ${reportAuthor}'s trip report`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {i === visible.length - 1 && extra > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-charcoal/60 text-sm font-semibold text-off-white">
              +{extra}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// react-markdown renders bare HTML elements with no classes by default —
// this maps them onto the app's own type scale instead of pulling in a
// typography plugin for what's ultimately a handful of tags.
// react-markdown passes an internal `node` (AST) prop to every custom
// renderer alongside the real DOM props — picking only the specific props
// each element needs (rather than `{...props}`-spreading everything blindly)
// keeps it from leaking onto the actual element as an invalid
// `node="[object Object]"` attribute.
// break-words matters more than it looks like it should here — this app's
// trip reports are full of long unbroken tokens (bare URLs, concatenated
// phone-number/coordinate strings from the original scraped data) that
// don't contain a space for the browser to wrap on. Without it, one long
// token forces its card wider than its grid/flex track, and that's exactly
// what pushes the whole page into horizontal scroll — not a viewport bug,
// a missing wrap rule on the one place long free text actually renders.
const markdownComponents: Components = {
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

/** Shared between the community feed, a single drive's "Trip Reports for
 * this Drive" section, and the report detail page — same card, three
 * contexts. `linkToDetail` and `showDriveContext` are the only things that
 * differ between them. */
export function TripReportCard({
  report,
  linkToDetail = false,
  showDriveContext = true,
  canDelete = false,
  deleteRedirectTo,
}: {
  report: TripReportCardData;
  linkToDetail?: boolean;
  showDriveContext?: boolean;
  /** Admin-only affordance — the three call sites (feed, drive-detail
   * section, report detail page) each derive this from their own viewer's
   * profiles.is_admin, never trusted from anywhere else. */
  canDelete?: boolean;
  /** See DeleteReportButton — only needed when this card is rendered on the
   * report's own detail page. */
  deleteRedirectTo?: string;
}) {
  const authorName = report.author?.full_name ?? report.author?.username ?? "A club member";

  const body = (
    <article className="group relative flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-sand bg-gradient-to-br from-off-white to-sand-light/40 p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md sm:gap-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Avatar name={authorName} avatarUrl={report.author?.avatar_url ?? null} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-semibold tracking-tight text-charcoal sm:text-base">
              {authorName}
            </span>
            {report.author && <RankBadge rank={report.author.current_rank} />}
          </div>
          <span className="text-xs text-charcoal-light/70">
            {formatRelativeTime(report.created_at)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {report.is_approved ? (
            <span className="flex items-center gap-1 rounded-full bg-forest/10 px-1.5 py-0.5 text-[10px] font-semibold text-forest">
              <BadgeCheck className="h-3.5 w-3.5" />
              Approved
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-sand-light px-1.5 py-0.5 text-[10px] font-semibold text-charcoal-light/70">
              <HourglassIcon className="h-3.5 w-3.5" />
              Pending
            </span>
          )}
          {canDelete && (
            <DeleteReportButton reportId={report.id} redirectTo={deleteRedirectTo} />
          )}
        </div>
      </div>

      {showDriveContext && report.drive && (
        <div className="inline-flex w-fit max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg bg-sand-light px-2.5 py-1 text-xs font-medium break-words text-charcoal-light/90">
          <span className="flex items-center gap-1">
            <Route className="h-3.5 w-3.5 shrink-0 text-forest" />
            {report.drive.title}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(report.drive.drive_date)}</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {report.drive.location}
          </span>
        </div>
      )}

      <div className="w-full min-w-0 text-xs text-charcoal sm:text-sm">
        <Markdown components={markdownComponents}>{cleanReportText(report.report_text)}</Markdown>
      </div>

      {report.photos && report.photos.length > 0 && (
        <PhotoGallery photos={report.photos} reportAuthor={authorName} />
      )}
    </article>
  );

  if (!linkToDetail) {
    return body;
  }

  return (
    <Link href={`/trip-reports/${report.id}`} className="block">
      {body}
    </Link>
  );
}
