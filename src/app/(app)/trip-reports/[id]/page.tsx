import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mountain, CheckSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { TripReportCard, type TripReportCardData } from "@/components/club/TripReportCard";
import { AttachToDriveControl, type PastDrive } from "@/components/club/AttachToDriveControl";

type TripReportDetail = TripReportCardData & {
  author_id: string;
  drive_id: string | null;
};

export default async function TripReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ reportSubmitted?: string }>;
}) {
  const { id } = await params;
  const { reportSubmitted } = await searchParams;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trip_reports")
    .select(
      `id, report_text, photos, created_at, is_approved, author_id, drive_id,
       author:profiles!trip_reports_author_id_fkey(username, full_name, avatar_url, current_rank),
       drive:drives(title, drive_date, location)`,
    )
    .eq("id", id)
    .single()
    .overrideTypes<TripReportDetail, { merge: false }>();

  if (error || !data) {
    notFound();
  }
  const report = data;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAuthorOrAdmin = false;
  if (user) {
    const isAuthor = report.author_id === user.id;
    let isAdmin = false;
    if (!isAuthor) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();
      isAdmin = profile?.is_admin ?? false;
    }
    isAuthorOrAdmin = isAuthor || isAdmin;
  }

  // Unapproved reports are only visible to their own author or an admin —
  // same boundary the public feed and the drive-detail section enforce by
  // only ever querying is_approved = true.
  if (!report.is_approved && !isAuthorOrAdmin) {
    notFound();
  }

  let pastDrives: PastDrive[] = [];
  if (isAuthorOrAdmin) {
    const { data: drivesData } = await supabase
      .from("drives")
      .select("id, title, drive_date, lead_marshal:profiles(username, full_name)")
      .eq("status", "Completed")
      .order("drive_date", { ascending: false })
      .overrideTypes<PastDrive[], { merge: false }>();
    pastDrives = drivesData ?? [];
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/trip-reports"
        className="flex items-center gap-1.5 text-sm font-medium text-charcoal-light/80 hover:text-forest"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Trip Reports
      </Link>

      {reportSubmitted === "pending" && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-forest/30 bg-forest/10 px-4 py-3 text-sm font-medium text-forest-dark"
        >
          <CheckSquare className="h-4 w-4 shrink-0" />
          Trip report submitted successfully and is pending Marshal review!
        </div>
      )}
      {reportSubmitted === "live" && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-forest/30 bg-forest/10 px-4 py-3 text-sm font-medium text-forest-dark"
        >
          <CheckSquare className="h-4 w-4 shrink-0" />
          Trip report submitted and live on the community feed!
        </div>
      )}

      <header className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Mountain className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-charcoal">Trip Report</h1>
      </header>

      <TripReportCard report={report} />

      {isAuthorOrAdmin && (
        <AttachToDriveControl
          reportId={report.id}
          currentDriveId={report.drive_id}
          pastDrives={pastDrives}
        />
      )}
    </div>
  );
}
