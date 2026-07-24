"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, LockOpen, CircleCheck, LoaderCircle, CircleAlert } from "lucide-react";
import {
  setRegistrationClosed,
  markDriveCompleted,
} from "@/app/(app)/drives/actions";
import { useDriveRegistration } from "@/components/club/DriveRegistrationContext";
import type { DriveStatus } from "@/components/club/DriveBadges";

/** Sits beside "Edit Drive" in the Marshal Logistics Control Panel — quick
 * status flips that don't need the full edit form. Marshals hitting "Mark
 * as Completed" too early just get the server's rejection inline (the real
 * enforcement lives in markDriveCompleted itself); Admins get a confirm
 * prompt first since they're allowed to override it. Both actions only
 * make sense on a still-Scheduled drive — once it's Completed or
 * Cancelled, neither renders (the server actions reject them too, this is
 * just so a Marshal doesn't see a live-looking button that'll only ever
 * error). */
export function DriveQuickActionButtons({
  driveId,
  isAdmin,
  status,
  registrationClosed,
}: {
  driveId: string;
  isAdmin: boolean;
  status: DriveStatus;
  registrationClosed: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );
  const driveRegistration = useDriveRegistration();
  // Falls back to the prop when rendered without a provider — same
  // fallback convention as DriveHero/RegistrationSection.
  const effectiveStatus = driveRegistration?.state.status ?? status;
  const effectiveRegistrationClosed =
    driveRegistration?.state.registrationClosed ?? registrationClosed;
  const isScheduled = effectiveStatus === "Scheduled";

  function handleToggleRegistration() {
    setMessage(null);
    const nextClosed = !effectiveRegistrationClosed;
    startTransition(async () => {
      driveRegistration?.optimisticallySetRegistrationClosed(nextClosed);
      const result = await setRegistrationClosed(driveId, nextClosed);
      setMessage({
        type: result.status === "error" ? "error" : "success",
        text: result.message ?? "",
      });
      if (result.status === "success") router.refresh();
    });
  }

  function handleMarkCompleted() {
    if (isAdmin) {
      const confirmed = window.confirm(
        "Mark this drive as completed now, even if it hasn't finished yet? This is only meant for early/administrative corrections.",
      );
      if (!confirmed) return;
    }
    setMessage(null);
    startTransition(async () => {
      driveRegistration?.optimisticallySetStatus("Completed");
      const result = await markDriveCompleted(driveId, isAdmin);
      setMessage({
        type: result.status === "error" ? "error" : "success",
        text: result.message ?? "",
      });
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {isScheduled ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleToggleRegistration}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-sand bg-off-white px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : effectiveRegistrationClosed ? (
              <LockOpen className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {effectiveRegistrationClosed ? "Reopen Registration" : "Close Registration"}
          </button>

          <button
            type="button"
            onClick={handleMarkCompleted}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-sand bg-off-white px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CircleCheck className="h-3.5 w-3.5" />
            )}
            Mark as Completed
          </button>
        </div>
      ) : (
        <p className="text-xs text-charcoal-light/60">
          This drive is marked {effectiveStatus} — registration and completion actions no longer
          apply.
        </p>
      )}

      {message && (
        <p
          className={`flex items-center gap-1.5 text-xs ${
            message.type === "error" ? "text-error" : "text-forest-dark"
          }`}
        >
          {message.type === "error" ? (
            <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CircleCheck className="h-3.5 w-3.5 shrink-0" />
          )}
          {message.text}
        </p>
      )}
    </div>
  );
}
