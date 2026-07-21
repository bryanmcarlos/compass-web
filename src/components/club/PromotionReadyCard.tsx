"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, HourglassIcon, LoaderCircle } from "lucide-react";
import { Avatar } from "./Avatar";
import { promoteToIntermediate } from "@/app/(app)/promotions-review/actions";

export type PromotionReadyMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  approvedCount: number;
  requiredCount: number;
  introToIntDone: boolean;
};

export function PromotionReadyCard({ member }: { member: PromotionReadyMember }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleFinalize() {
    setMessage(null);
    startTransition(async () => {
      const result = await promoteToIntermediate(member.userId);
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
            {member.approvedCount}/{member.requiredCount} Drives · Must Skills ✓ · R1 ✓ · R2 ✓
          </span>
        </div>
      </div>

      {member.introToIntDone ? (
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={isPending}
            onClick={handleFinalize}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
            Finalize Promotion to Intermediate
          </button>
          {message && <p className="text-xs text-charcoal-light/80">{message}</p>}
        </div>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-sand-light px-3 py-1.5 text-xs font-semibold text-charcoal-light/80">
          <HourglassIcon className="h-3.5 w-3.5" />
          Awaiting Intro to INT Drive
        </span>
      )}
    </div>
  );
}
