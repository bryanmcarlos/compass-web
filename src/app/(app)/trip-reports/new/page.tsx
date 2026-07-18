import { redirect } from "next/navigation";
import { PenLine, TriangleAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import {
  SubmitReportForm,
  type CompletedDrive,
} from "@/components/club/SubmitReportForm";

export default async function NewTripReportPage({
  searchParams,
}: {
  searchParams: Promise<{ driveId?: string }>;
}) {
  const { driveId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to share a trip report.");
  }

  // Scoped to drives *this* user was registered for — you can only ever
  // file a report against a drive you actually participated in (checked
  // again server-side in the Server Action regardless of what this list
  // shows), so there's no point offering drives you weren't on.
  const { data, error } = await supabase
    .from("drives")
    .select("id, drive_id_code, title, drive_date, location, drive_registrations!inner(user_id)")
    .eq("status", "Completed")
    .eq("drive_registrations.user_id", user.id)
    .order("drive_date", { ascending: false })
    .overrideTypes<CompletedDrive[], { merge: false }>();

  const completedDrives = data ?? [];

  // A ?driveId= arriving from "Share a Trip Report" on a drive page that
  // this user wasn't registered for (or that isn't Completed) won't match
  // anything in the scoped list above — SubmitReportForm already falls back
  // to the unselected placeholder in that case, but silently doing that
  // with no explanation reads as a bug. Naming it here instead.
  const driveIdNotAvailable = Boolean(driveId) && !completedDrives.some((d) => d.id === driveId);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <PenLine className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Share a Trip Report
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Recap a completed drive for the community. Reports are reviewed by
          a marshal before they go public.
        </p>
      </header>

      {driveIdNotAvailable && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-bg p-3 text-sm text-error"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            You can only file a report for a drive you were registered for —
            showing the general form instead.
          </span>
        </div>
      )}

      {error ? (
        <ErrorState message="Couldn't load completed drives right now. Please try again shortly." />
      ) : (
        <SubmitReportForm completedDrives={completedDrives} initialDriveId={driveId} />
      )}
    </div>
  );
}
