import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mountain, CheckSquare, PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { TripReportCard, type TripReportCardData } from "@/components/club/TripReportCard";
import { AttachToDriveControl, type PastDrive } from "@/components/club/AttachToDriveControl";

type TripReportDetail = TripReportCardData & {
  author_id: string;
  drive_id: string | null;
};

const SUBMIT_BANNER_MESSAGE = {
  pending: "Trip report submitted successfully and is pending Marshal review!",
  live: "Trip report submitted and live on the community feed!",
  updated: "Trip report updated.",
} as const;

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

  // isAdmin is kept as its own variable, not just folded into
  // isAuthorOrAdmin — the delete button below is admin-only, not
  // author-or-admin, so an author who happens to also be an admin still
  // needs the real value here, not a short-circuited "already know they can
  // see this page" true/false.
  let isAdmin = false;
  let isAuthorOrAdmin = false;
  if (user) {
    const isAuthor = report.author_id === user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
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

      {reportSubmitted && reportSubmitted in SUBMIT_BANNER_MESSAGE && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-forest/30 bg-forest/10 px-4 py-3 text-sm font-medium text-forest-dark"
        >
          <CheckSquare className="h-4 w-4 shrink-0" />
          {SUBMIT_BANNER_MESSAGE[reportSubmitted as keyof typeof SUBMIT_BANNER_MESSAGE]}
        </div>
      )}

      <header className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
          <Mountain className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-bold tracking-tight text-charcoal">Trip Report</h1>
      </header>

      <TripReportCard report={report} canDelete={isAdmin} deleteRedirectTo="/trip-reports" />

      {user?.id === report.author_id && (
        <Link
          href={`/trip-reports/${report.id}/edit`}
          className="flex w-fit items-center gap-2 self-center rounded-lg border border-primary/40 bg-off-white px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <PenLine className="h-4 w-4" />
          Edit Your Trip Report
        </Link>
      )}

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
