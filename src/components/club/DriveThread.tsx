import Link from "next/link";
import { Award, Calendar, MapPin, Route } from "lucide-react";
import { TripReportCard, type TripReportCardData } from "./TripReportCard";
import { CommentThread, type CommentData } from "./CommentThread";
import { formatDate } from "@/lib/format";

export type ThreadReport = TripReportCardData & {
  author_id: string;
  drive_id: string;
};

export type ThreadDrive = {
  id: string;
  title: string;
  drive_date: string;
  location: string;
};

/** One drive's worth of the reports feed — header, then (if one was found)
 * the registered Lead's report shown distinctly first, then every other
 * report in chronological order, each with its own comment thread beneath
 * it. `leadReport` is null far more often than not (verified against live
 * data: only ~6% of drives with reports have one authored by their
 * registered Lead) — this never assumes one exists. */
export function DriveThread({
  drive,
  leadReport,
  otherReports,
  commentsByReport,
  canDelete,
}: {
  drive: ThreadDrive;
  leadReport: ThreadReport | null;
  otherReports: ThreadReport[];
  commentsByReport: Map<string, CommentData[]>;
  canDelete: boolean;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm sm:p-6">
      <Link
        href={`/drives/${drive.id}`}
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-charcoal hover:text-forest"
      >
        <span className="flex items-center gap-1.5">
          <Route className="h-4 w-4 shrink-0 text-forest" />
          {drive.title}
        </span>
        <span aria-hidden="true" className="text-charcoal-light/40">
          ·
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-charcoal-light/70">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          {formatDate(drive.drive_date)}
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-charcoal-light/70">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {drive.location}
        </span>
      </Link>

      {leadReport && (
        <div className="flex flex-col gap-2">
          <span className="flex w-fit items-center gap-1.5 rounded-full bg-forest/10 px-2.5 py-1 text-[11px] font-semibold text-forest">
            <Award className="h-3.5 w-3.5 shrink-0" />
            Lead Summary
          </span>
          <TripReportCard report={leadReport} linkToDetail showDriveContext={false} canDelete={canDelete} />
          <CommentThread reportId={leadReport.id} comments={commentsByReport.get(leadReport.id) ?? []} />
        </div>
      )}

      {otherReports.map((report, index) => {
        // A top border/gap separates each report block from the one above
        // it — except the very first content block in the whole thread
        // (index 0 with no Lead Summary preceding it), which would
        // otherwise get a stray border right under the drive header link.
        const isFirstContentBlock = !leadReport && index === 0;
        return (
          <div
            key={report.id}
            className={`flex flex-col gap-2 ${isFirstContentBlock ? "" : "border-t border-sand pt-4"}`}
          >
            <TripReportCard report={report} linkToDetail showDriveContext={false} canDelete={canDelete} />
            <CommentThread reportId={report.id} comments={commentsByReport.get(report.id) ?? []} />
          </div>
        );
      })}
    </section>
  );
}
