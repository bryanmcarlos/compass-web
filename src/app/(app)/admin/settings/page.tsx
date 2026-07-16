import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { AdminSettingsForm } from "@/components/club/AdminSettingsForm";
import { getAppSettings } from "@/lib/appSettings";

export default async function AdminSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to access Admin Settings.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  const { primaryColor, logoUrl, defaultDriveBannerUrl } = await getAppSettings();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Admin Settings
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Site-wide branding and theme — changes apply for every member as
          soon as they&apos;re saved.
        </p>
      </header>

      <AdminSettingsForm
        initialPrimaryColor={primaryColor}
        initialLogoUrl={logoUrl}
        initialDefaultBannerUrl={defaultDriveBannerUrl}
      />
    </div>
  );
}
