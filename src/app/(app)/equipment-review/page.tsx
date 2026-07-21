import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState, EmptyState } from "@/components/club/StateMessage";
import { Tabs } from "@/components/club/Tabs";
import { EquipmentReviewCard, type EquipmentReviewMember } from "@/components/club/EquipmentReviewCard";
import { MANDATORY_EQUIPMENT } from "@/lib/constants";

type Row = {
  user_id: string;
  item_name: string;
  status: "uploaded" | "verified";
  proof_url: string;
  profile: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

export default async function EquipmentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to review equipment submissions.");
  }

  const { data: viewerProfile } = await supabase
    .from("profiles")
    .select("is_marshal, is_admin")
    .eq("id", user.id)
    .single();

  const canReview = Boolean(viewerProfile?.is_marshal || viewerProfile?.is_admin);
  if (!canReview) {
    redirect("/");
  }

  const { data: rows, error } = await supabase
    .from("equipment_verifications")
    .select(
      "user_id, item_name, status, proof_url, profile:profiles!equipment_verifications_user_id_fkey(username, full_name, avatar_url)",
    )
    .overrideTypes<Row[], { merge: false }>();

  const membersById = new Map<string, EquipmentReviewMember>();
  for (const row of rows ?? []) {
    if (!row.profile) continue;
    let member = membersById.get(row.user_id);
    if (!member) {
      member = {
        userId: row.user_id,
        name: row.profile.full_name ?? row.profile.username,
        avatarUrl: row.profile.avatar_url,
        items: MANDATORY_EQUIPMENT.map((name) => ({ name, status: "pending", proofUrl: null })),
      };
      membersById.set(row.user_id, member);
    }
    const item = member.items.find((i) => i.name === row.item_name);
    if (item) {
      item.status = row.status;
      item.proofUrl = row.proof_url;
    }
  }

  const allMembers = Array.from(membersById.values());
  const pendingMembers = allMembers.filter((m) => m.items.some((i) => i.status === "uploaded"));
  const verifiedMembers = allMembers.filter(
    (m) => m.items.length > 0 && m.items.every((i) => i.status === "verified"),
  );

  const tabs = [
    { key: "pending", label: `Pending Review (${pendingMembers.length})` },
    { key: "verified", label: `Fully Verified (${verifiedMembers.length})` },
  ];
  const activeTab = tab === "verified" ? "verified" : "pending";
  const members = activeTab === "verified" ? verifiedMembers : pendingMembers;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Equipment Verification
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Review each member&apos;s 15-point gear check submissions.
        </p>
      </header>

      <Tabs tabs={tabs} defaultKey="pending" />

      {error ? (
        <ErrorState message="Couldn't load equipment submissions right now. Please try again shortly." />
      ) : members.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={activeTab === "verified" ? "No one fully verified yet" : "Nothing pending"}
          message={
            activeTab === "verified"
              ? "Once a member's all 15 items are verified, they'll show up here."
              : "Every submitted equipment proof has already been reviewed."
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {members.map((member) => (
            <EquipmentReviewCard key={member.userId} member={member} />
          ))}
        </div>
      )}
    </div>
  );
}
