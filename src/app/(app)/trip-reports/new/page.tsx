import { redirect } from "next/navigation";
import { PenLine } from "lucide-react";
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

  const { data, error } = await supabase
    .from("drives")
    .select("id, drive_id_code, title, drive_date, location")
    .eq("status", "Completed")
    .order("drive_date", { ascending: false })
    .overrideTypes<CompletedDrive[], { merge: false }>();

  const completedDrives = data ?? [];

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

      {error ? (
        <ErrorState message="Couldn't load completed drives right now. Please try again shortly." />
      ) : (
        <SubmitReportForm completedDrives={completedDrives} initialDriveId={driveId} />
      )}
    </div>
  );
}
