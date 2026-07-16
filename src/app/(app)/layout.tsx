import type { ReactNode } from "react";
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
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  return <Layout isAdmin={isAdmin}>{children}</Layout>;
}
