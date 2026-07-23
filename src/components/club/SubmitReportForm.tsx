"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Route,
  ChevronDown,
  NotebookPen,
  Send,
  LoaderCircle,
  CircleAlert,
  Lock,
} from "lucide-react";
import { submitTripReport, type SubmitReportState } from "@/app/(app)/trip-reports/actions";
import { PhotoDropzone } from "@/components/club/PhotoDropzone";
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
  initialDriveId,
}: {
  completedDrives: CompletedDrive[];
  /** Prefills the drive dropdown, e.g. arriving via "Share yours" from a
   * specific drive's page. Falls back to the placeholder if it isn't one of
   * `completedDrives` (drive not yet marked Completed, typo'd id, etc.) —
   * the member can still pick manually, nothing breaks. */
  initialDriveId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitTripReport,
    initialState,
  );
  const [photosUploading, setPhotosUploading] = useState(false);

  // Arrived from a specific drive's "Share yours" link — locked, not just
  // pre-selected, so the report can't accidentally end up attached to a
  // different drive than the one the member actually clicked through from.
  // A disabled <select> wouldn't submit its value via FormData at all, so
  // this renders a plain non-interactive display plus a hidden input
  // instead, rather than a disabled select.
  const lockedDrive =
    initialDriveId ? completedDrives.find((d) => d.id === initialDriveId) : undefined;

  // No form.reset()-on-success handling here anymore — a successful
  // submission now redirects away entirely (to the drive page or the new
  // report itself), handled server-side in the Action, so this component
  // never actually observes a "success" state to react to. Only errors
  // ever populate `state` in practice.

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="driveId" className="text-sm font-medium text-charcoal">
          Drive
        </label>
        {lockedDrive ? (
          <div className="flex items-center gap-2 rounded-lg border border-sand bg-sand-light px-3 py-2 text-sm text-charcoal-light/90">
            <Lock className="h-4 w-4 shrink-0 text-charcoal-light/60" />
            <span className="min-w-0 flex-1 truncate">
              {lockedDrive.title} — {formatDate(lockedDrive.drive_date)} · {lockedDrive.location}
            </span>
            <input type="hidden" id="driveId" name="driveId" value={lockedDrive.id} />
          </div>
        ) : (
          <div className="relative">
            <Route className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
            <select
              id="driveId"
              name="driveId"
              defaultValue=""
              className="w-full appearance-none rounded-lg border border-sand bg-off-white py-2 pr-9 pl-9 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
            >
              <option value="">Not tied to a specific drive</option>
              {completedDrives.length > 0 && (
                <optgroup label="Completed Drives">
                  {completedDrives.map((drive) => (
                    <option key={drive.id} value={drive.id}>
                      {drive.title} — {formatDate(drive.drive_date)} ·{" "}
                      {drive.location}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          </div>
        )}
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
            className="w-full resize-y rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
      </div>

      <PhotoDropzone onUploadingChange={setPhotosUploading} />

      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-bg p-3 text-sm text-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {state.message}
            {state.existingReportId && (
              <>
                {" "}
                <Link
                  href={`/trip-reports/${state.existingReportId}`}
                  className="font-semibold underline hover:no-underline"
                >
                  View your existing report
                </Link>
                .
              </>
            )}
          </span>
        </div>
      )}

      {photosUploading && (
        <p className="flex items-center gap-1.5 text-xs text-charcoal-light/60">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Photos are still uploading…
        </p>
      )}

      <button
        type="submit"
        disabled={pending || photosUploading}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
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
