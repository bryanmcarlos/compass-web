"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, HourglassIcon, Lock, LoaderCircle, Send } from "lucide-react";
import { submitSoloGpsDrive } from "@/app/(app)/profile/exams/actions";
import { SOLO_GPS_DRIVES_REQUIRED } from "@/lib/constants";

/** Purpose-built sibling to ExamSubmissionForm, not a second mode bolted
 * onto it — the semantics genuinely differ. R1/R2/I1/I2/I3 are "submit
 * once, pass once, done"; this is "submit up to 3 separate real-world solo
 * drives, need 3 passes total." A single latest-status badge can't
 * represent that, so this tracks a running passed-count instead. */
export function SoloGpsDriveForm({
  passedCount,
  hasPending,
  locked,
}: {
  passedCount: number;
  hasPending: boolean;
  locked: boolean;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const complete = passedCount >= SOLO_GPS_DRIVES_REQUIRED;
  const canSubmit = !locked && !complete && !hasPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await submitSoloGpsDrive(notes);
    setIsError(result.status === "error");
    setMessage(result.message);
    setPending(false);

    if (result.status === "success") {
      setNotes("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-charcoal">3 Solo GPS Proficiency Drives</h3>
          <p className="text-xs text-charcoal-light/70">
            Night &amp; day, minimum 50km each — inform your Marshal beforehand, then submit a
            photo/video and recorded GPX track link here.
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            complete
              ? "bg-forest/10 text-forest"
              : "bg-sand-light text-charcoal-light/70"
          }`}
        >
          {complete && <CircleCheck className="h-3.5 w-3.5" />}
          {passedCount}/{SOLO_GPS_DRIVES_REQUIRED} Passed
        </span>
      </div>

      {locked && !complete && (
        <p className="flex items-center gap-1.5 rounded-lg bg-sand-light px-3 py-2 text-xs text-charcoal-light/70">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          Unlocks once your required drives and must-skills above are complete.
        </p>
      )}

      {hasPending && !complete && (
        <p className="flex items-center gap-1.5 rounded-lg bg-diff-moderate-bg px-3 py-2 text-xs text-diff-moderate">
          <HourglassIcon className="h-3.5 w-3.5 shrink-0" />
          Awaiting marshal review — you can log your next solo drive once this one&apos;s graded.
        </p>
      )}

      {canSubmit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-charcoal">Photo/video + GPX track link, or notes</label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Link to your photo/video and GPX track, plus which night/day drive this was…"
              className="rounded-lg border border-sand bg-off-white px-3 py-2 text-sm text-charcoal"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex w-fit items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {pending ? "Submitting…" : `Log Solo Drive ${passedCount + 1}`}
          </button>

          {message && <p className={`text-xs ${isError ? "text-error" : "text-forest"}`}>{message}</p>}
        </form>
      )}
    </div>
  );
}
