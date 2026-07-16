import { redirect } from "next/navigation";
import { ShieldAlert, Route } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { DriveForm } from "@/components/club/DriveForm";

export default async function NewDrivePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to post a drive.");
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
          Only club marshals can post official drives.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Route className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Post a Drive
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Schedule an official drive and mark which curriculum skills it addresses.
        </p>
      </header>

      <DriveForm mode="create" />
    </div>
  );
}
