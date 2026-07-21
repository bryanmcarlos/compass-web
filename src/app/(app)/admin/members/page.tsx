import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import { MembersTable, type Member } from "@/components/club/MembersTable";

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

  const { data: members, error } = await supabase
    .from("profiles")
    .select(
      "id, username, full_name, avatar_url, current_rank, is_marshal, is_mit, is_disabled, is_approved, mobile_number, car_details",
    )
    .order("username", { ascending: true })
    .overrideTypes<Member[], { merge: false }>();

  if (error || !members) {
    return <ErrorState message="Couldn't load members right now. Please try again shortly." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-charcoal-light/80">
        {members.length} member{members.length === 1 ? "" : "s"} — search,
        adjust rank, or manage account access.
      </p>
      <MembersTable members={members} currentUserId={user.id} />
    </div>
  );
}
