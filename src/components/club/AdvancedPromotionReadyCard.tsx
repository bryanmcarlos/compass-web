"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, LoaderCircle } from "lucide-react";
import { Avatar } from "./Avatar";
import { promoteToAdvanced } from "@/app/(app)/promotions-review/actions";

export type AdvancedPromotionReadyMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  approvedCount: number;
  requiredCount: number;
  soloGpsPassedCount: number;
  leadDriveCount: number;
};

/** Mirrors PromotionReadyCard.tsx's structure — every stage's "ready" card
 * follows the same shape by now (Avatar + stats line + finalize button +
 * inline message). No gated final must-skill for this stage (unlike
 * Newbie/Rookie), so unlike those two siblings this one never has a
 * "waiting on one more drive" locked state — every listed member is
 * already fully finalize-able. */
export function AdvancedPromotionReadyCard({ member }: { member: AdvancedPromotionReadyMember }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleFinalize() {
    setMessage(null);
    startTransition(async () => {
      const result = await promoteToAdvanced(member.userId);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-charcoal">{member.name}</span>
          <span className="text-xs text-charcoal-light/70">
            {member.approvedCount}/{member.requiredCount} Drives · Must Skills ✓ · I1/I2/I3 ✓ · Solo
            GPS {member.soloGpsPassedCount}/3 · Led {member.leadDriveCount}/3
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={isPending}
          onClick={handleFinalize}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
          Finalize Promotion to Advanced
        </button>
        {message && <p className="text-xs text-charcoal-light/80">{message}</p>}
      </div>
    </div>
  );
}
