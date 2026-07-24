"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  CircleAlert,
  HourglassIcon,
  LoaderCircle,
  Send,
  Lock,
  CalendarCheck,
  Search,
  X,
} from "lucide-react";
import { submitExam, type ExamType } from "@/app/(app)/profile/exams/actions";
import { Avatar } from "./Avatar";

export type ExamStatus = "not_submitted" | "pending" | "accepted" | "passed" | "failed";

export type BuddyOption = { id: string; name: string; username: string; avatarUrl: string | null };

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
  if (status === "accepted") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[10px] font-semibold text-forest">
        <CalendarCheck className="h-3.5 w-3.5" />
        Accepted — Exam Drive Scheduled
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

/** Search-as-you-type buddy picker — same filter-by-name/username pattern
 * as the admin members search, scoped server-side to fellow Rookies who've
 * also cleared the drives/must-skills bar (see the query in
 * profile/exams/page.tsx), so every result here is actually a valid buddy,
 * not just any club member. */
function BuddyPicker({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: BuddyOption[];
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.username.toLowerCase().includes(q),
    );
  }, [options, query]);

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-forest/30 bg-forest/5 px-3 py-2">
        <Avatar name={selected.name} avatarUrl={selected.avatarUrl} className="h-7 w-7 text-xs" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-charcoal">{selected.name}</span>
          <span className="truncate text-xs text-charcoal-light/60">@{selected.username}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setQuery("");
            setOpen(true);
          }}
          aria-label="Change buddy"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-charcoal-light/60 hover:bg-sand-light"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search fellow Rookies by name or username…"
          className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-sm text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
        />
      </div>
      {open && (
        <div className="flex max-h-48 flex-col overflow-y-auto rounded-lg border border-sand bg-off-white shadow-sm">
          {filtered.length === 0 ? (
            <p className="px-3 py-2.5 text-xs text-charcoal-light/60">
              No eligible Rookie matches — they need their own 5 drives and must-skills done too.
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-2 text-left hover:bg-sand-light"
              >
                <Avatar name={o.name} avatarUrl={o.avatarUrl} className="h-7 w-7 text-xs" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-charcoal">{o.name}</span>
                  <span className="truncate text-xs text-charcoal-light/60">@{o.username}</span>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
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
  lockedReason = "Unlocks once your 5 drives and must-skills above are complete.",
  examDrive,
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
  /** Overrides the generic locked message — used for R2, which is also
   * locked behind R1 being passed and reported, not just drives/must-skills. */
  lockedReason?: string;
  /** The exam drive a Marshal accepted this submission into, once status is
   * "accepted" or later — lets the member jump straight to it instead of
   * hunting for it in Official Drives. */
  examDrive?: { id: string; title: string; driveIdCode: string } | null;
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
          {lockedReason}
        </p>
      )}

      {status === "accepted" && examDrive && (
        <Link
          href={`/drives/${examDrive.id}`}
          className="flex items-center gap-1.5 rounded-lg border border-forest/30 bg-forest/5 px-3 py-2 text-xs font-semibold text-forest-dark transition-colors hover:border-forest/50"
        >
          <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
          You&apos;re registered — {examDrive.driveIdCode}: {examDrive.title}
        </Link>
      )}

      {canSubmit && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {requiresBuddy && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-charcoal">
                Buddy named in your challenge post
              </label>
              <BuddyPicker value={buddyId} onChange={setBuddyId} options={buddyOptions} />
              <p className="text-[11px] text-charcoal-light/60">
                Only who you did the challenge together with — real exam-day pairs are decided
                separately at the exam drive.
              </p>
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
