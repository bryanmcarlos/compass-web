"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, Send, Users, CalendarCheck, Plus } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";
import { acceptExamSubmissions } from "@/app/(app)/promotions-review/actions";
import type { ExamSubmissionReview } from "./ExamReviewCard";

export type CandidateExamDrive = {
  id: string;
  title: string;
  driveIdCode: string;
  driveDate: string;
};

/** R1/R2-specific replacement for ExamReviewCard's direct pass/fail —
 * pending challenges here aren't graded until the exam drive they're
 * accepted into has actually happened (see gradeExamDriveSubmissions on the
 * drive detail page). A Marshal picks which upcoming exam drive this batch
 * is for, checks off who's being accepted into it, and everyone selected
 * gets auto-registered. I1/I2/I3/solo-GPS still use the old direct-grade
 * ExamReviewCard, unaffected by this. */
export function ChallengeAcceptancePanel({
  submissions,
  candidateDrives,
  examType,
  examLabel,
}: {
  submissions: ExamSubmissionReview[];
  /** Already scoped server-side to Scheduled drives flagged with this exact
   * exam_type — see fetchCandidateExamDrives. */
  candidateDrives: CandidateExamDrive[];
  examType: string;
  examLabel: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [driveId, setDriveId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAccept() {
    setMessage(null);
    startTransition(async () => {
      const result = await acceptExamSubmissions(Array.from(selected), driveId);
      setIsError(result.status === "error");
      setMessage(result.message);
      if (result.status === "success") {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const createDriveHref = `/drives/new?examType=${encodeURIComponent(examType)}&title=${encodeURIComponent(`${examLabel} Exam Drive`)}`;

  return (
    <div className="flex flex-col gap-4">
      {candidateDrives.length === 0 && (
        <p className="flex flex-wrap items-center gap-1.5 rounded-lg border border-sand bg-sand-light px-3 py-2.5 text-xs text-charcoal-light/80">
          No upcoming drive is flagged for {examLabel} yet.
          <Link
            href={createDriveHref}
            className="flex items-center gap-1 font-semibold text-forest hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Create the Exam Drive
          </Link>
        </p>
      )}

      <div className="flex flex-col gap-3">
        {submissions.map((s) => (
          <label
            key={s.id}
            className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm has-[:checked]:border-forest/50 has-[:checked]:bg-forest/5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
                />
                <Avatar name={s.submitterName} avatarUrl={s.submitterAvatarUrl} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-charcoal">
                    {s.submitterName}
                  </span>
                  <span className="text-xs text-charcoal-light/70">
                    {formatRelativeTime(s.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <p className="rounded-lg bg-sand-light/50 p-3 text-sm break-words text-charcoal">
              {s.notes}
            </p>

            {s.buddy && (
              <div className="flex items-center gap-2 rounded-lg border border-forest/30 bg-forest/5 p-3">
                <Users className="h-4 w-4 shrink-0 text-forest" />
                <span className="text-xs font-medium text-forest-dark">Named buddy:</span>
                <Avatar name={s.buddy.name} avatarUrl={s.buddy.avatarUrl} className="h-6 w-6 text-xs" />
                <span className="truncate text-sm font-semibold text-charcoal">{s.buddy.name}</span>
              </div>
            )}
          </label>
        ))}
      </div>

      <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-4 shadow-md">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-charcoal">Accept selected into exam drive</span>
          <select
            value={driveId}
            onChange={(e) => setDriveId(e.target.value)}
            disabled={candidateDrives.length === 0}
            className="rounded-lg border border-sand bg-off-white px-3 py-2 text-sm text-charcoal disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="">Select the exam drive…</option>
            {candidateDrives.map((d) => (
              <option key={d.id} value={d.id}>
                {d.driveIdCode}: {d.title} ({d.driveDate})
              </option>
            ))}
          </select>
          <Link
            href={createDriveHref}
            className="flex w-fit items-center gap-1 text-xs font-medium text-forest hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            Create another exam drive
          </Link>
        </label>

        <button
          type="button"
          disabled={isPending || selected.size === 0 || !driveId}
          onClick={handleAccept}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarCheck className="h-4 w-4" />
          )}
          {isPending
            ? "Accepting…"
            : `Accept ${selected.size || ""} into Exam Drive`.replace("  ", " ")}
        </button>

        {message && (
          <p className={`flex items-center gap-1.5 text-xs ${isError ? "text-error" : "text-forest"}`}>
            {!isError && <Send className="h-3.5 w-3.5 shrink-0" />}
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
