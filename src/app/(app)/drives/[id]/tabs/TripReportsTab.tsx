import type { ReactNode } from "react";
import { Mountain } from "lucide-react";
import { TripReportCard, type TripReportCardData } from "@/components/club/TripReportCard";
import { PendingReportsReview, type PendingReport } from "@/components/club/PendingReportsReview";
import type { RegistrationRole } from "@/lib/driveRoles";

export function TripReportsTab({
  tripReports,
  pendingReports,
  canReviewReports,
  isAdmin,
  myRegistration,
  myExistingReportId,
  reportCta,
}: {
  tripReports: TripReportCardData[];
  pendingReports: PendingReport[];
  canReviewReports: boolean;
  isAdmin: boolean;
  myRegistration: { role: RegistrationRole } | null;
  myExistingReportId: string | null;
  reportCta: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {canReviewReports && <PendingReportsReview reports={pendingReports} canDelete={isAdmin} />}

      <section className="flex flex-col gap-4 rounded-2xl border border-sand bg-gradient-to-br from-off-white to-sand-light/30 p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Mountain className="h-4 w-4 text-forest" />
          Trip Reports for this Drive
        </h2>

        {tripReports.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-sand px-5 py-8 text-center">
            <p className="max-w-sm text-sm text-charcoal-light/80">
              {myRegistration && !myExistingReportId
                ? "No trip reports filed for this adventure yet. Be the first to share yours!"
                : "No trip reports filed for this adventure yet."}
            </p>
            {reportCta}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tripReports.map((report) => (
                <TripReportCard
                  key={report.id}
                  report={report}
                  linkToDetail
                  showDriveContext={false}
                  canDelete={isAdmin}
                />
              ))}
            </div>
            {myRegistration && <div className="self-center">{reportCta}</div>}
          </>
        )}
      </section>
    </div>
  );
}
