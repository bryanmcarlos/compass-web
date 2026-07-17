import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { AdminTabs } from "@/components/club/AdminTabs";

/** Shared by every /admin/* sub-route — the is_admin guard and the tab nav
 * only need to live here once, not duplicated in each page.tsx. */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to access Admin.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">Admin</h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Site-wide branding, theme, and member management — changes apply
          for every member as soon as they&apos;re saved.
        </p>
      </header>

      <AdminTabs />

      {children}
    </div>
  );
}
