"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  Route,
  ChevronDown,
  NotebookPen,
  ImagePlus,
  Send,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  CalendarCheck,
} from "lucide-react";
import { submitTripReport, type SubmitReportState } from "@/app/(app)/trip-reports/actions";
import { EmptyState } from "@/components/club/StateMessage";
import { formatDate } from "@/lib/format";

export type CompletedDrive = {
  id: string;
  drive_id_code: string;
  title: string;
  drive_date: string;
  location: string;
};

const initialState: SubmitReportState = { status: "idle", message: null };

export function SubmitReportForm({
  completedDrives,
}: {
  completedDrives: CompletedDrive[];
}) {
  const [state, formAction, pending] = useActionState(
    submitTripReport,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  if (completedDrives.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No completed drives yet"
        message="You can share a trip report once a drive you attended has been marked completed."
      />
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="driveId" className="text-sm font-medium text-charcoal">
          Drive
        </label>
        <div className="relative">
          <Route className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          <select
            id="driveId"
            name="driveId"
            required
            defaultValue=""
            className="w-full appearance-none rounded-lg border border-sand bg-off-white py-2.5 pr-9 pl-9 text-sm text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          >
            <option value="" disabled>
              Select a completed drive…
            </option>
            {completedDrives.map((drive) => (
              <option key={drive.id} value={drive.id}>
                {drive.title} — {formatDate(drive.drive_date)} ·{" "}
                {drive.location}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="reportText"
          className="text-sm font-medium text-charcoal"
        >
          Your report
        </label>
        <p className="text-xs text-charcoal-light/70">
          Describe your experience, what you learned, and any recovery
          situations.
        </p>
        <div className="relative">
          <NotebookPen className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-charcoal-light/60" />
          <textarea
            id="reportText"
            name="reportText"
            required
            minLength={20}
            rows={6}
            placeholder="We tackled the river crossing at km 4, which was flowing higher than expected..."
            className="w-full resize-y rounded-lg border border-sand bg-off-white py-2.5 pr-3 pl-9 text-sm text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="photoUrls"
          className="text-sm font-medium text-charcoal"
        >
          Photo URLs{" "}
          <span className="font-normal text-charcoal-light/60">
            (optional)
          </span>
        </label>
        <p className="text-xs text-charcoal-light/70">
          One image link per line — hosted on Cloudinary, Imgur, etc.
        </p>
        <div className="relative">
          <ImagePlus className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-charcoal-light/60" />
          <textarea
            id="photoUrls"
            name="photoUrls"
            rows={3}
            placeholder={
              "https://res.cloudinary.com/your-club/trail-1.jpg\nhttps://i.imgur.com/example.jpg"
            }
            className="w-full resize-y rounded-lg border border-sand bg-off-white py-2.5 pr-3 pl-9 text-sm text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
      </div>

      {state.status !== "idle" && state.message && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
            state.status === "error"
              ? "border-error/30 bg-error-bg text-error"
              : "border-forest/30 bg-forest/10 text-forest-dark"
          }`}
        >
          {state.status === "error" ? (
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{state.message}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {pending ? "Submitting…" : "Submit Report"}
      </button>
    </form>
  );
}
