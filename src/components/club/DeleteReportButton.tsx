"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2, LoaderCircle } from "lucide-react";
import { deleteTripReport } from "@/app/(app)/trip-reports/actions";

export function DeleteReportButton({
  reportId,
  redirectTo,
}: {
  reportId: string;
  /** Where to navigate after a successful delete — omit to just refresh the
   * current page in place (feed / drive-detail contexts, where the deleted
   * card simply needs to disappear from a list it isn't the only thing on).
   * Pass this on the report's own detail page instead: that page's data no
   * longer exists post-delete, so refreshing in place would just 404. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete(e: MouseEvent<HTMLButtonElement>) {
    // TripReportCard can wrap itself in a <Link> (linkToDetail) — this
    // button lives inside that link's hit area, so a click has to be
    // stopped here or it also triggers navigation to the report.
    e.preventDefault();
    e.stopPropagation();

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this trip report?",
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await deleteTripReport(reportId);
      if (result.status === "error") {
        setError(result.message ?? "Couldn't delete this report.");
        return;
      }
      if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        aria-label="Delete report"
        title="Delete report"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-error/70 transition-colors hover:bg-error-bg hover:text-error disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
      {error && <span className="text-[10px] text-error">{error}</span>}
    </div>
  );
}
