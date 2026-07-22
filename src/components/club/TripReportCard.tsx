import Link from "next/link";
import Markdown from "react-markdown";
import { BadgeCheck, HourglassIcon, MapPin, Route } from "lucide-react";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";
import { rankNameFromLevel } from "@/lib/constants";
import { DeleteReportButton } from "./DeleteReportButton";
import { PhotoGallery } from "./PhotoGallery";
import { LikeButton } from "./LikeButton";
import { markdownComponents } from "./markdownComponents";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { cleanReportText } from "@/lib/tripReportText";
import { toggleTripReportReaction } from "@/app/(app)/trip-reports/actions";

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
  likeCount = 0,
  viewerLiked = false,
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
  /** Callers batch-fetch report_reactions the same way they already do for
   * comments — defaults to 0/false rather than a required prop so this
   * doesn't ripple into every call site that hasn't been touched. */
  likeCount?: number;
  viewerLiked?: boolean;
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
            {report.author && <RankBadge rank={rankNameFromLevel(report.author.current_rank)} />}
          </div>
          <span className="text-xs text-charcoal-light/70">
            {formatRelativeTime(report.created_at)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <LikeButton
            initialLiked={viewerLiked}
            initialCount={likeCount}
            toggleAction={() => toggleTripReportReaction(report.id)}
          />
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
