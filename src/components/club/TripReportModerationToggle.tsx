"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, LoaderCircle, CircleAlert } from "lucide-react";
import { toggleTripReportModeration } from "@/app/(app)/admin/site-settings/actions";

export function TripReportModerationToggle({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !enabled;
    setError(null);
    startTransition(async () => {
      const result = await toggleTripReportModeration(next);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setEnabled(result.enabled ?? next);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-charcoal">Trip Report Moderation</h2>
            <p className="text-xs text-charcoal-light/70 sm:text-sm">
              When enabled, Marshals must manually approve driver trip
              reports before they go public. When disabled, reports are
              auto-approved instantly upon submission.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle trip report moderation"
          onClick={handleToggle}
          disabled={isPending}
          className={`relative flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            enabled ? "bg-primary" : "bg-sand-dark/60"
          }`}
        >
          <span
            className={`absolute h-5 w-5 rounded-full bg-off-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        {isPending ? (
          <span className="flex items-center gap-1.5 text-charcoal-light/60">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </span>
        ) : (
          <span
            className={`font-medium ${enabled ? "text-forest-dark" : "text-charcoal-light/60"}`}
          >
            {enabled
              ? "Moderation is ON — reports need marshal approval."
              : "Moderation is OFF — reports go live instantly."}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-xs text-error">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
