import { redirect, notFound } from "next/navigation";
import { PenLine } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { EditReportForm } from "@/components/club/EditReportForm";

// See new/page.tsx — same reasoning, this page's form can also trigger a
// Cloudinary photo upload via the Server Action.
export const maxDuration = 30;

export default async function EditTripReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to edit your trip report.");
  }

  const { data: report, error } = await supabase
    .from("trip_reports")
    .select("id, report_text, photos, author_id")
    .eq("id", id)
    .single();

  if (error || !report) {
    notFound();
  }

  // Author-only — see updateTripReport for why this doesn't also extend to
  // Admins the way approve/attach do.
  if (report.author_id !== user.id) {
    redirect(`/trip-reports/${id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <PenLine className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Edit Your Trip Report
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Update your recap or swap out photos — changes save immediately.
        </p>
      </header>

      <EditReportForm
        reportId={report.id}
        initialReportText={report.report_text}
        initialPhotos={report.photos ?? []}
      />
    </div>
  );
}
