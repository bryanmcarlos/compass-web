import Link from "next/link";
import { Mountain, PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EmptyState, ErrorState } from "@/components/club/StateMessage";
import { TripReportCard, type TripReportCardData } from "@/components/club/TripReportCard";

export default async function TripReportsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trip_reports")
    .select(
      `id, report_text, photos, created_at, is_approved,
       author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url, current_rank),
       drive:drives(title, drive_date, location)`,
    )
    .eq("is_approved", true)
    .order("created_at", { ascending: false })
    .limit(50)
    .overrideTypes<TripReportCardData[], { merge: false }>();

  const reports = data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
              <Mountain className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-charcoal">
              Trip Reports
            </h1>
          </div>
          <p className="text-sm text-charcoal-light/80">
            Approved recaps from the community — the club&apos;s learning
            journal.
          </p>
        </div>
        <Link
          href="/trip-reports/new"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90"
        >
          <PenLine className="h-4 w-4" />
          Share a Trip Report
        </Link>
      </header>

      {error ? (
        <ErrorState message="Couldn't load trip reports right now. Please try again shortly." />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Mountain}
          title="No trip reports yet"
          message="Approved recaps from official drives will show up here once members share them."
        />
      ) : (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
          {reports.map((report) => (
            <TripReportCard key={report.id} report={report} linkToDetail />
          ))}
        </div>
      )}
    </div>
  );
}
