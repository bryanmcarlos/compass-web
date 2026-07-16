"use client";

import { useState, useTransition } from "react";
import { LogOut, LoaderCircle, CircleAlert } from "lucide-react";
import { unregisterFromDrive } from "@/app/(app)/drives/[id]/actions";

export function UnregisterButton({ driveId }: { driveId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await unregisterFromDrive(driveId);
            if (result.status === "error") {
              setError(result.message);
            }
          });
        }}
        className="flex items-center justify-center gap-2 rounded-lg border border-charcoal-light/30 bg-sand-light px-4 py-2.5 text-sm font-semibold text-charcoal-light transition-colors hover:border-error/40 hover:bg-error-bg hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        {isPending ? "Leaving…" : "Unregister from Drive"}
      </button>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-bg px-3 py-2 text-sm text-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
