import { redirect } from "next/navigation";
import { createClient as createServiceRoleClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import { MembersTable, type Member } from "@/components/club/MembersTable";

/** Login email lives in Supabase's `auth.users`, never exposed to the
 * normal client — same reasoning and pattern as `/api/admin/users`'s
 * `requireAdminServiceClient`: a one-off, request-local service-role
 * client, never persisted or sent to the browser, used only for what has
 * no RLS-respecting equivalent. This page already sits behind
 * admin/layout.tsx's redirect, but re-checking `is_admin` here too matches
 * every other place in this app that touches the service-role key rather
 * than trusting a parent layout's gate. Paginated (`perPage: 1000` looped)
 * since `listUsers` defaults to far fewer per page than this club's
 * ~500-member roster. */
async function fetchEmailsByUserId(isAdmin: boolean): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isAdmin || !serviceRoleKey) return emails;

  const adminClient = createServiceRoleClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error || !data) {
      console.error("PAGE ERROR [admin/members email lookup]:", error);
      break;
    }
    for (const authUser of data.users) {
      if (authUser.email) emails.set(authUser.id, authUser.email);
    }
    if (data.users.length < perPage) break;
    page += 1;
  }

  return emails;
}

export default async function AdminMembersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // admin/layout.tsx already redirects non-admins away, but that check
  // happens on `user` too — this is just narrowing the type back down for
  // the `currentUserId` prop below, not a second security check.
  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  const isAdmin = profile?.is_admin ?? false;

  const [{ data: members, error }, emailsByUserId] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, full_name, avatar_url, current_rank, is_marshal, is_mit, is_disabled, is_approved, mobile_number, car_details",
      )
      .order("username", { ascending: true })
      .overrideTypes<Omit<Member, "email">[], { merge: false }>(),
    fetchEmailsByUserId(isAdmin),
  ]);

  if (error || !members) {
    return <ErrorState message="Couldn't load members right now. Please try again shortly." />;
  }

  const membersWithEmail: Member[] = members.map((m) => ({
    ...m,
    email: emailsByUserId.get(m.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-charcoal-light/80">
        {members.length} member{members.length === 1 ? "" : "s"} — search,
        adjust rank, or manage account access.
      </p>
      <MembersTable members={membersWithEmail} currentUserId={user.id} />
    </div>
  );
}
