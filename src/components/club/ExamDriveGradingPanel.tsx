"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, RotateCcw, LoaderCircle, Users, GraduationCap } from "lucide-react";
import { Avatar } from "./Avatar";
import { gradeExamDriveSubmissions } from "@/app/(app)/promotions-review/actions";

export type ExamDriveSubmissionGroup = {
  /** Grouping key — sorted [user_id, buddy_id ?? user_id] joined together,
   * so a buddy pair (each having submitted their own row naming the other)
   * collapses into one card instead of two. */
  key: string;
  examType: "R1_CATCH_THE_FLAG" | "R2_MAZE";
  /** All exam_submissions ids in this group — 2 for a graded pair, 1 for a
   * solo submission (R2 has no buddy) — graded together in one action. */
  submissionIds: string[];
  members: { name: string; avatarUrl: string | null }[];
  status: "accepted" | "passed" | "failed";
};

const EXAM_LABEL: Record<ExamDriveSubmissionGroup["examType"], string> = {
  R1_CATCH_THE_FLAG: "R1: Catch the Flag",
  R2_MAZE: "R2: Maze",
};

function GroupRow({ group }: { group: ExamDriveSubmissionGroup }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleGrade(status: "passed" | "failed") {
    setMessage(null);
    startTransition(async () => {
      const result = await gradeExamDriveSubmissions(group.submissionIds, status);
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sand bg-off-white p-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {group.members.length > 1 && <Users className="h-4 w-4 shrink-0 text-forest" />}
        <div className="flex -space-x-2">
          {group.members.map((m, i) => (
            <Avatar key={i} name={m.name} avatarUrl={m.avatarUrl} className="ring-2 ring-off-white" />
          ))}
        </div>
        <span className="min-w-0 truncate text-sm font-medium text-charcoal">
          {group.members.map((m) => m.name).join(" & ")}
        </span>
      </div>

      {group.status === "accepted" ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleGrade("passed")}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CircleCheck className="h-3.5 w-3.5" />}
            Pass
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleGrade("failed")}
            className="flex items-center gap-1.5 rounded-lg border border-sand px-3 py-2 text-xs font-semibold text-charcoal transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-70"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Fail
          </button>
        </div>
      ) : (
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            group.status === "passed" ? "bg-forest/10 text-forest" : "bg-error-bg text-error"
          }`}
        >
          {group.status === "passed" ? "Passed" : "Failed"}
        </span>
      )}

      {message && <p className="w-full text-xs text-charcoal-light/80">{message}</p>}
    </div>
  );
}

/** Shown on a Completed drive that was accepted as an R1/R2 exam drive —
 * lets a Marshal grade each driver (or buddy pair, graded together) who
 * was accepted into it. Only meaningful once the drive has actually
 * happened, which the page only renders this for in the first place. */
export function ExamDriveGradingPanel({ groups }: { groups: ExamDriveSubmissionGroup[] }) {
  const byExamType = new Map<string, ExamDriveSubmissionGroup[]>();
  for (const g of groups) {
    const list = byExamType.get(g.examType) ?? [];
    list.push(g);
    byExamType.set(g.examType, list);
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-forest/30 bg-forest/5 p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
        <GraduationCap className="h-4 w-4 text-forest" />
        Exam Grading
      </h2>
      {Array.from(byExamType.entries()).map(([examType, examGroups]) => (
        <div key={examType} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-charcoal-light/70 uppercase">
            {EXAM_LABEL[examType as ExamDriveSubmissionGroup["examType"]]}
          </h3>
          <div className="flex flex-col gap-2">
            {examGroups.map((g) => (
              <GroupRow key={g.key} group={g} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
