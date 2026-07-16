"use client";

import { useActionState } from "react";
import { ShieldCheck, LoaderCircle, CircleCheck, CircleAlert } from "lucide-react";
import {
  requestPromotion,
  type RequestPromotionState,
} from "@/app/(app)/profile/actions";

const initialState: RequestPromotionState = { status: "idle", message: null };

export function RequestPromotionButton({
  targetRank,
  targetRankTitle,
  alreadyPending,
}: {
  targetRank: number;
  targetRankTitle: string;
  alreadyPending: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestPromotion,
    initialState,
  );

  const isLocked = alreadyPending || state.status === "success";

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="targetRank" value={targetRank} />
      <button
        type="submit"
        disabled={pending || isLocked}
        className="flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
        {pending
          ? "Submitting…"
          : isLocked
            ? "Promotion Pending"
            : `Request ${targetRankTitle} Examination`}
      </button>

      {state.message && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            state.status === "error"
              ? "border-error/30 bg-error-bg text-error"
              : "border-forest/30 bg-forest/10 text-forest-dark"
          }`}
        >
          {state.status === "error" ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{state.message}</span>
        </div>
      )}
    </form>
  );
}
