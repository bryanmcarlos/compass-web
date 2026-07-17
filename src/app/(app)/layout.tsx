import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { Layout } from "@/components/club/Layout";

export default async function AppGroupLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin, is_disabled")
      .eq("id", user.id)
      .single();

    // A disabled member's Supabase Auth session is still technically valid —
    // there's no service-role key available to actually ban them at the Auth
    // layer — so this app-level gate is what actually keeps them out, on
    // every authenticated route.
    if (profile?.is_disabled) {
      redirect("/login?error=Your account has been disabled. Contact a Super Admin.");
    }
    isAdmin = profile?.is_admin ?? false;
  }

  return <Layout isAdmin={isAdmin}>{children}</Layout>;
}
