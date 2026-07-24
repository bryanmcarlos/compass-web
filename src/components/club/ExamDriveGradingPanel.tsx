"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, RotateCcw, LoaderCircle, GraduationCap } from "lucide-react";
import { Avatar } from "./Avatar";
import { gradeExamDriveSubmissions } from "@/app/(app)/promotions-review/actions";

export type ExamDriveExamType =
  | "R1_CATCH_THE_FLAG"
  | "R2_MAZE"
  | "I1_POINT_AND_SHOOT"
  | "I2_NIGHT_RECON"
  | "I3_KING_OF_THE_HILL";

export type ExamDriveSubmissionEntry = {
  id: string;
  examType: ExamDriveExamType;
  status: "accepted" | "passed" | "failed";
  name: string;
  avatarUrl: string | null;
};

const EXAM_LABEL: Record<ExamDriveExamType, string> = {
  R1_CATCH_THE_FLAG: "R1: Catch the Flag",
  R2_MAZE: "R2: Maze",
  I1_POINT_AND_SHOOT: "I1: Point & Shoot",
  I2_NIGHT_RECON: "I2: Night Recon",
  I3_KING_OF_THE_HILL: "I3: King of the Hill",
};

/** Shown on a Completed drive that was accepted as an R1/R2/I1/I2/I3 exam
 * drive — lets a Marshal grade each accepted member. R1 is the only one of
 * these with a named buddy at submission time, and even there this
 * deliberately doesn't auto-pair by it — real exam-day pairs are
 * reshuffled live at the drive, not fixed by that name, so a Marshal
 * selects whoever was actually paired (or grades solo) via the checkboxes
 * here and grades them together in one action. */
export function ExamDriveGradingPanel({ entries }: { entries: ExamDriveSubmissionEntry[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGrade(status: "passed" | "failed") {
    setMessage(null);
    startTransition(async () => {
      const result = await gradeExamDriveSubmissions(Array.from(selected), status);
      setMessage(result.message);
      if (result.status === "success") {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const byExamType = new Map<string, ExamDriveSubmissionEntry[]>();
  for (const e of entries) {
    const list = byExamType.get(e.examType) ?? [];
    list.push(e);
    byExamType.set(e.examType, list);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-forest/30 bg-forest/5 p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
        <GraduationCap className="h-4 w-4 text-forest" />
        Exam Grading
      </h2>
      <p className="text-xs text-charcoal-light/70">
        Check off whoever was actually paired together (or graded solo) on the day, then grade
        them in one action.
      </p>

      {Array.from(byExamType.entries()).map(([examType, examEntries]) => (
        <div key={examType} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
            {EXAM_LABEL[examType as ExamDriveSubmissionEntry["examType"]]}
          </h3>
          <div className="flex flex-col gap-2">
            {examEntries.map((entry) => (
              <label
                key={entry.id}
                className={`flex items-center gap-3 rounded-lg border border-sand bg-off-white p-3 ${
                  entry.status === "accepted" ? "cursor-pointer has-[:checked]:border-forest/50 has-[:checked]:bg-forest/5" : ""
                }`}
              >
                {entry.status === "accepted" ? (
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggle(entry.id)}
                    className="h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
                  />
                ) : (
                  <span className="w-4 shrink-0" />
                )}
                <Avatar name={entry.name} avatarUrl={entry.avatarUrl} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-charcoal">
                  {entry.name}
                </span>
                {entry.status !== "accepted" && (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      entry.status === "passed" ? "bg-forest/10 text-forest" : "bg-error-bg text-error"
                    }`}
                  >
                    {entry.status === "passed" ? "Passed" : "Failed"}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isPending || selected.size === 0}
          onClick={() => handleGrade("passed")}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
          Pass Selected ({selected.size})
        </button>
        <button
          type="button"
          disabled={isPending || selected.size === 0}
          onClick={() => handleGrade("failed")}
          className="flex items-center gap-1.5 rounded-lg border border-sand px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Fail Selected ({selected.size})
        </button>
      </div>

      {message && <p className="text-xs text-charcoal-light/80">{message}</p>}
    </section>
  );
}
