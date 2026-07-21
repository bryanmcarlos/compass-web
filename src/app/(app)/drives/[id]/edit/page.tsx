import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ShieldAlert, Settings } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { DriveForm, type DriveFormValues } from "@/components/club/DriveForm";

export default async function EditDrivePage({
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
    redirect("/login?error=Sign in to edit this drive.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_marshal")
    .eq("id", user.id)
    .single();

  if (!profile?.is_marshal) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 rounded-2xl border border-dashed border-sand bg-off-white px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sand-light text-forest">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="text-base font-semibold text-charcoal">Marshals only</h1>
        <p className="max-w-sm text-sm text-charcoal-light/80">
          Only club marshals can edit official drives.
        </p>
      </div>
    );
  }

  const { data: drive, error } = await supabase
    .from("drives")
    .select(
      `id, drive_id_code, title, status, drive_date, location,
       meeting_point_name, coordinates, exit_location, nearest_petrol_station, map_url,
       meeting_time, drive_start_time, drive_end_time,
       radio_frequency, target_rank, allowed_ranks, is_all_levels, max_drivers, equipment_requirements, must_skills_covered, banner_url,
       has_camp, camp_date, camp_time, camp_location, camp_coordinates, camp_schedule_type`,
    )
    .eq("id", id)
    .single()
    .overrideTypes<DriveFormValues, { merge: false }>();

  if (error || !drive) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Settings className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Edit Drive
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          {drive.title} ({drive.drive_id_code}) — you can still update Must
          Skills after this drive is marked Completed.
        </p>
      </header>

      <DriveForm mode="edit" initialValues={drive} />

      <Link
        href={`/drives/${drive.id}`}
        className="text-center text-sm font-medium text-charcoal-light/80 hover:text-forest"
      >
        Back to drive details
      </Link>
    </div>
  );
}
