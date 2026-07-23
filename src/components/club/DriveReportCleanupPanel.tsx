import { Wrench, CalendarDays, Tags, UserRound, Link2 as LinkedIcon, MessagesSquare } from "lucide-react";
import { CollapsibleSection } from "@/components/club/CollapsibleSection";
import { LinkTripReportButton } from "@/components/club/LinkTripReportButton";
import { formatDate } from "@/lib/format";
import { previewText } from "@/lib/tripReportMatching";

export type CleanupCandidateReport = {
  id: string;
  report_text: string;
  created_at: string;
  /** Not rendered directly — needed by dedupeByThread's generic constraint
   * upstream (it groups raw candidate rows into one-per-thread before this
   * type is ever built), kept here so the fetched row and the deduped
   * output share one type instead of two near-identical ones. */
  thread_id: string | null;
  author: { username: string; full_name: string | null } | null;
  /** The report's current link, if any — shown so an admin can see this
   * report will be pulled off its existing drive (if it has one) before
   * deciding to steal it for this one. Not the same thing this tool drops:
   * that's whatever's currently on *this* drive, not the report's own past. */
  currentDrive: { id: string; title: string } | null;
  /** Other posts sharing this report's thread — always the thread's root
   * post by the time this reaches the panel (deduped via dedupeByThread),
   * so linking it moves every one of these replies too. 0 for an organic,
   * non-threaded report. */
  replyCount: number;
};

function CandidateReportRow({
  report,
  driveId,
}: {
  report: CleanupCandidateReport;
  driveId: string;
}) {
  const authorName = report.author?.full_name ?? report.author?.username ?? "Unknown author";
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-sand px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-charcoal-light/70">
          <span className="flex items-center gap-1 font-medium text-charcoal">
            <UserRound className="h-3 w-3 shrink-0" />
            {authorName}
          </span>
          <span>·</span>
          <span>{formatDate(report.created_at)}</span>
          {report.replyCount > 0 && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <MessagesSquare className="h-3 w-3 shrink-0" />
                +{report.replyCount} {report.replyCount === 1 ? "reply" : "replies"}
              </span>
            </>
          )}
          {report.currentDrive && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 text-primary">
                <LinkedIcon className="h-3 w-3 shrink-0" />
                Currently on: {report.currentDrive.title}
              </span>
            </>
          )}
        </div>
        <p className="truncate text-xs text-charcoal-light/90">{previewText(report.report_text)}</p>
      </div>
      <LinkTripReportButton reportId={report.id} driveId={driveId} />
    </li>
  );
}

function CandidateList({
  title,
  icon,
  candidates,
  driveId,
}: {
  title: string;
  icon: React.ReactNode;
  candidates: CleanupCandidateReport[];
  driveId: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-charcoal-light/60 uppercase">
        {icon}
        {title} ({candidates.length})
      </h4>
      {candidates.length === 0 ? (
        <p className="rounded-lg bg-sand-light px-3 py-2 text-xs text-charcoal-light/60 italic">
          No candidates.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {candidates.map((report) => (
            <CandidateReportRow key={report.id} report={report} driveId={driveId} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Admin-only, temporary — surfaces likely-mislinked or unlinked trip
 * reports for this specific drive, grouped by the same two signals the
 * original forum migration got wrong when used alone (date proximity,
 * title-keyword overlap). Linking here always wins over whatever's
 * currently attached to this drive — see relinkTripReportToDrive. */
export function DriveReportCleanupPanel({
  driveId,
  dateCandidates,
  keywordCandidates,
}: {
  driveId: string;
  dateCandidates: CleanupCandidateReport[];
  keywordCandidates: CleanupCandidateReport[];
}) {
  return (
    <CollapsibleSection
      title="Admin: Link Existing Reports to This Drive"
      icon={<Wrench className="h-4 w-4 text-forest" />}
      defaultOpen={false}
      className="border-primary/30"
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-charcoal-light/70">
          Reports from anywhere in the system that might actually belong to this drive.
          Linking a threaded report moves its whole thread (every reply comes with it);
          linking here always detaches whatever thread or report currently occupies this drive.
        </p>
        <CandidateList
          title="Within 20 Days"
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          candidates={dateCandidates}
          driveId={driveId}
        />
        <CandidateList
          title="Similar Keywords"
          icon={<Tags className="h-3.5 w-3.5" />}
          candidates={keywordCandidates}
          driveId={driveId}
        />
      </div>
    </CollapsibleSection>
  );
}
