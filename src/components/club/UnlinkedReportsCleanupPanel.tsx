import Link from "next/link";
import { Wrench, CalendarDays, Tags, UserRound, ArrowUpRight } from "lucide-react";
import { CollapsibleSection } from "@/components/club/CollapsibleSection";
import { LinkTripReportButton } from "@/components/club/LinkTripReportButton";
import { formatDate } from "@/lib/format";
import { previewText } from "@/lib/tripReportMatching";

export type CleanupCandidateDrive = {
  id: string;
  title: string;
  drive_date: string;
};

export type UnlinkedReport = {
  id: string;
  report_text: string;
  created_at: string;
  author: { username: string; full_name: string | null } | null;
  dateCandidates: CleanupCandidateDrive[];
  keywordCandidates: CleanupCandidateDrive[];
};

function CandidateDriveRow({ drive, reportId }: { drive: CleanupCandidateDrive; reportId: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-sand px-3 py-2">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-xs font-medium text-charcoal">{drive.title}</span>
        <span className="text-[11px] text-charcoal-light/70">{formatDate(drive.drive_date)}</span>
      </span>
      <LinkTripReportButton reportId={reportId} driveId={drive.id} />
    </li>
  );
}

function CandidateDriveList({
  title,
  icon,
  candidates,
  reportId,
}: {
  title: string;
  icon: React.ReactNode;
  candidates: CleanupCandidateDrive[];
  reportId: string;
}) {
  if (candidates.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <h5 className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-charcoal-light/60 uppercase">
        {icon}
        {title} ({candidates.length})
      </h5>
      <ul className="flex flex-col gap-1.5">
        {candidates.map((drive) => (
          <CandidateDriveRow key={drive.id} drive={drive} reportId={reportId} />
        ))}
      </ul>
    </div>
  );
}

function UnlinkedReportCard({ report }: { report: UnlinkedReport }) {
  const authorName = report.author?.full_name ?? report.author?.username ?? "Unknown author";
  const hasCandidates = report.dateCandidates.length > 0 || report.keywordCandidates.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-sand bg-off-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-charcoal-light/70">
          <span className="flex items-center gap-1 font-medium text-charcoal">
            <UserRound className="h-3 w-3 shrink-0" />
            {authorName}
          </span>
          <span>·</span>
          <span>{formatDate(report.created_at)}</span>
        </div>
        <Link
          href={`/trip-reports/${report.id}`}
          className="flex items-center gap-1 text-[11px] font-medium text-forest hover:underline"
        >
          Open report
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <p className="text-xs text-charcoal-light/90">{previewText(report.report_text, 220)}</p>

      {hasCandidates ? (
        <div className="flex flex-col gap-3 border-t border-sand pt-3">
          <CandidateDriveList
            title="Within 20 Days"
            icon={<CalendarDays className="h-3 w-3" />}
            candidates={report.dateCandidates}
            reportId={report.id}
          />
          <CandidateDriveList
            title="Similar Keywords"
            icon={<Tags className="h-3 w-3" />}
            candidates={report.keywordCandidates}
            reportId={report.id}
          />
        </div>
      ) : (
        <p className="border-t border-sand pt-3 text-xs text-charcoal-light/60 italic">
          No automatic candidates — link manually from the report&apos;s own page.
        </p>
      )}
    </div>
  );
}

/** Admin-only, temporary — the /trip-reports counterpart to
 * DriveReportCleanupPanel, for the other direction: a report with no
 * drive_id at all, looking for candidate drives instead of a drive looking
 * for candidate reports. Same underlying relinkTripReportToDrive action
 * either way. */
export function UnlinkedReportsCleanupPanel({ reports }: { reports: UnlinkedReport[] }) {
  return (
    <CollapsibleSection
      title={`Admin: Unlinked Trip Reports (${reports.length})`}
      icon={<Wrench className="h-4 w-4 text-forest" />}
      defaultOpen={false}
      className="border-primary/30"
    >
      {reports.length === 0 ? (
        <p className="text-xs text-charcoal-light/60 italic">
          Nothing unlinked — every trip report is attached to a drive.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((report) => (
            <UnlinkedReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
}
