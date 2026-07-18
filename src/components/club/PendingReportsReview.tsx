"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert, CircleCheck, LoaderCircle, CircleAlert } from "lucide-react";
import { approveTripReport } from "@/app/(app)/trip-reports/actions";
import { Avatar } from "./Avatar";

export type PendingReport = {
  id: string;
  report_text: string;
  author: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** A short plain-text preview — strips the light markdown syntax this app's
 * reports use (bold, blockquote, bullets) rather than rendering it, since
 * this is meant to be a quick snippet for a review queue, not the full
 * report. */
function snippet(text: string, max = 220) {
  const clean = text
    .replace(/[#*_>`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

export function PendingReportsReview({ reports }: { reports: PendingReport[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const visible = reports.filter((r) => !dismissed.has(r.id));
  if (visible.length === 0) {
    return null;
  }

  function handleApprove(reportId: string) {
    setPendingId(reportId);
    setError(null);
    startTransition(async () => {
      const result = await approveTripReport(reportId);
      if (result.status === "error") {
        setError({ id: reportId, message: result.message ?? "Couldn't approve this report." });
        setPendingId(null);
        return;
      }
      // Drop it from the queue immediately rather than waiting on the
      // server round-trip — router.refresh() still syncs the rest of the
      // page (e.g. the now-public card in "Trip Reports for this Drive").
      setDismissed((prev) => new Set(prev).add(reportId));
      setPendingId(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-diff-moderate/40 bg-diff-moderate-bg p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
        <TriangleAlert className="h-4 w-4 text-diff-moderate" />
        ⚠️ Pending Marshal Review
      </h2>

      <div className="flex flex-col gap-3">
        {visible.map((report) => {
          const authorName =
            report.author?.full_name ?? report.author?.username ?? "A club member";
          const isThisPending = isPending && pendingId === report.id;

          return (
            <div
              key={report.id}
              className="flex flex-col gap-3 rounded-xl border border-sand bg-off-white p-4"
            >
              <div className="flex items-start gap-3">
                <Avatar
                  name={authorName}
                  avatarUrl={report.author?.avatar_url ?? null}
                  className="h-8 w-8 shrink-0 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-charcoal">{authorName}</p>
                  <p className="text-sm break-words text-charcoal-light/80">
                    {snippet(report.report_text)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleApprove(report.id)}
                  disabled={isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isThisPending ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CircleCheck className="h-3.5 w-3.5" />
                  )}
                  Approve Report
                </button>
                {error?.id === report.id && (
                  <span className="flex items-center gap-1.5 text-xs text-error">
                    <CircleAlert className="h-3.5 w-3.5 shrink-0" />
                    {error.message}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
