"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleAlert, HourglassIcon, LoaderCircle, Send, Lock } from "lucide-react";
import { submitExam, type ExamType } from "@/app/(app)/profile/exams/actions";

export type ExamStatus = "not_submitted" | "pending" | "passed" | "failed";

export type BuddyOption = { id: string; name: string };

function StatusBadge({ status }: { status: ExamStatus }) {
  if (status === "passed") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest">
        <CircleCheck className="h-3.5 w-3.5" />
        Passed
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-diff-moderate-bg px-2 py-0.5 text-[10px] font-semibold text-diff-moderate">
        <HourglassIcon className="h-3.5 w-3.5" />
        Under Review
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-error-bg px-2 py-0.5 text-[10px] font-semibold text-error">
        <CircleAlert className="h-3.5 w-3.5" />
        Resubmission Needed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-sand-light px-2 py-0.5 text-[10px] font-semibold text-charcoal-light/70">
      Not Submitted
    </span>
  );
}

export function ExamSubmissionForm({
  examType,
  title,
  description,
  status,
  requiresBuddy,
  buddyOptions,
  locked,
}: {
  examType: ExamType;
  title: string;
  description: string;
  status: ExamStatus;
  requiresBuddy: boolean;
  buddyOptions: BuddyOption[];
  /** True until the 5 required drives and must-skills are done — matches
   * the same gate submitExam re-checks server-side, so this is purely a
   * clearer UI than a generic rejection message would be, not the real
   * enforcement. */
  locked: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [buddyId, setBuddyId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const canSubmit = !locked && (status === "not_submitted" || status === "failed");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await submitExam(examType, notes, requiresBuddy ? buddyId : undefined);
    setIsError(result.status === "error");
    setMessage(result.message);
    setPending(false);

    if (result.status === "success") {
      setNotes("");
      setBuddyId("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-charcoal">{title}</h3>
          <p className="text-xs text-charcoal-light/70">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {locked && (status === "not_submitted" || status === "failed") && (
        <p className="flex items-center gap-1.5 rounded-lg bg-sand-light px-3 py-2 text-xs text-charcoal-light/70">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Unlocks once your 5 drives and must-skills above are complete.
        </p>
      )}

      {canSubmit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {requiresBuddy && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal">Buddy</label>
              <select
                required
                value={buddyId}
                onChange={(e) => setBuddyId(e.target.value)}
                className="rounded-lg border border-sand bg-off-white px-3 py-2 text-sm text-charcoal"
              >
                <option value="" disabled>
                  Select the buddy you named in your post
                </option>
                {buddyOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-charcoal">
              Challenge post link or notes
            </label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Link to your post, GPX track, or a description of what you completed…"
              className="rounded-lg border border-sand bg-off-white px-3 py-2 text-sm text-charcoal"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex w-fit items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {pending ? "Submitting…" : "Submit for Review"}
          </button>

          {message && (
            <p className={`text-xs ${isError ? "text-error" : "text-forest"}`}>{message}</p>
          )}
        </form>
      )}
    </div>
  );
}
