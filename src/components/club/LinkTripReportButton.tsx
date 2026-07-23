"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, LoaderCircle, CircleCheck, CircleAlert } from "lucide-react";
import { relinkTripReportToDrive } from "@/app/(app)/trip-reports/actions";

/** Used by both admin cleanup panels — drive-detail's "candidate reports"
 * list and /trip-reports' "unlinked reports" list — since the underlying
 * operation is identical either way: point `reportId` at `driveId`,
 * detaching whatever report(s) currently occupy that drive. */
export function LinkTripReportButton({
  reportId,
  driveId,
  label = "Link",
}: {
  reportId: string;
  driveId: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  function handleClick() {
    setMessage(null);
    startTransition(async () => {
      const result = await relinkTripReportToDrive(reportId, driveId);
      setMessage({
        type: result.status === "error" ? "error" : "success",
        text: result.message ?? "",
      });
      if (result.status === "success") {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-off-white px-2.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Link2 className="h-3.5 w-3.5" />
        )}
        {label}
      </button>
      {message && (
        <span
          className={`flex items-center gap-1 text-right text-[11px] ${
            message.type === "error" ? "text-error" : "text-forest-dark"
          }`}
        >
          {message.type === "error" ? (
            <CircleAlert className="h-3 w-3 shrink-0" />
          ) : (
            <CircleCheck className="h-3 w-3 shrink-0" />
          )}
          {message.text}
        </span>
      )}
    </div>
  );
}
