"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, LoaderCircle, RotateCcw, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import { formatRelativeTime } from "@/lib/format";
import { gradeExam } from "@/app/(app)/promotions-review/actions";

export type ExamSubmissionReview = {
  id: string;
  submitterName: string;
  submitterAvatarUrl: string | null;
  notes: string;
  createdAt: string;
  buddy: { name: string; avatarUrl: string | null } | null;
};

export function ExamReviewCard({ submission }: { submission: ExamSubmissionReview }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleGrade(status: "passed" | "failed") {
    setMessage(null);
    startTransition(async () => {
      const result = await gradeExam(submission.id, status);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={submission.submitterName} avatarUrl={submission.submitterAvatarUrl} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-charcoal">
              {submission.submitterName}
            </span>
            <span className="text-xs text-charcoal-light/70">
              {formatRelativeTime(submission.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <p className="rounded-lg bg-sand-light/50 p-3 text-sm break-words text-charcoal">
        {submission.notes}
      </p>

      {submission.buddy && (
        <div className="flex items-center gap-2 rounded-lg border border-forest/30 bg-forest/5 p-3">
          <Users className="h-4 w-4 shrink-0 text-forest" />
          <span className="text-xs font-medium text-forest-dark">Named buddy:</span>
          <Avatar
            name={submission.buddy.name}
            avatarUrl={submission.buddy.avatarUrl}
            className="h-6 w-6 text-xs"
          />
          <span className="truncate text-sm font-semibold text-charcoal">
            {submission.buddy.name}
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleGrade("passed")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
          Pass & Approve
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleGrade("failed")}
          className="flex items-center gap-1.5 rounded-lg border border-sand px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Request Re-submission
        </button>
      </div>

      {message && <p className="text-xs text-charcoal-light/80">{message}</p>}
    </div>
  );
}
