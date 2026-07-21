import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Wrench } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { ErrorState } from "@/components/club/StateMessage";
import { EquipmentGrid, type EquipmentItem } from "@/components/club/EquipmentGrid";
import { MANDATORY_EQUIPMENT } from "@/lib/constants";

export default async function EquipmentPortalPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Sign in to view your equipment checklist.");
  }

  const { data: rows, error } = await supabase
    .from("equipment_verifications")
    .select("item_name, status, proof_url")
    .eq("user_id", user.id)
    .overrideTypes<
      { item_name: string; status: "uploaded" | "verified"; proof_url: string }[],
      { merge: false }
    >();

  const rowsByItem = new Map((rows ?? []).map((row) => [row.item_name, row]));

  const items: EquipmentItem[] = MANDATORY_EQUIPMENT.map((name) => {
    const row = rowsByItem.get(name);
    return {
      name,
      status: row?.status ?? "pending",
      proofUrl: row?.proof_url ?? null,
    };
  });

  const verifiedCount = items.filter((item) => item.status === "verified").length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/profile"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-charcoal-light/70 hover:text-charcoal"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Profile
        </Link>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest">
            <Wrench className="h-5 w-5" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-charcoal">
            Equipment Checklist
          </h1>
        </div>
        <p className="text-sm text-charcoal-light/80">
          Upload a photo of each mandatory gear item — a marshal reviews and
          verifies every submission. All 15 must be verified to qualify for
          the Rookie promotion.
        </p>
        <p className="text-sm font-semibold text-charcoal">
          {verifiedCount}/{MANDATORY_EQUIPMENT.length} Verified
        </p>
      </header>

      {error ? (
        <ErrorState message="Couldn't load your equipment checklist right now. Please try again shortly." />
      ) : (
        <EquipmentGrid items={items} />
      )}
    </div>
  );
}
