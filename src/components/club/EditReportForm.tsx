"use client";

import { useActionState, useState } from "react";
import { NotebookPen, Save, LoaderCircle, CircleAlert } from "lucide-react";
import { updateTripReport, type UpdateReportState } from "@/app/(app)/trip-reports/actions";
import { PhotoDropzone } from "@/components/club/PhotoDropzone";

const initialState: UpdateReportState = { status: "idle", message: null };

export function EditReportForm({
  reportId,
  initialReportText,
  initialPhotos,
}: {
  reportId: string;
  initialReportText: string;
  initialPhotos: string[];
}) {
  const [state, formAction, pending] = useActionState(updateTripReport, initialState);
  const [photosUploading, setPhotosUploading] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      <input type="hidden" name="reportId" value={reportId} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reportText" className="text-sm font-medium text-charcoal">
          Your report
        </label>
        <div className="relative">
          <NotebookPen className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-charcoal-light/60" />
          <textarea
            id="reportText"
            name="reportText"
            required
            minLength={20}
            rows={8}
            defaultValue={initialReportText}
            className="w-full resize-y rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
      </div>

      <PhotoDropzone initialPhotos={initialPhotos} onUploadingChange={setPhotosUploading} />

      {state.status === "error" && state.message && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-bg p-3 text-sm text-error"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
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
          <Save className="h-4 w-4" />
        )}
        {pending ? "Saving…" : "Save Changes"}
      </button>
    </form>
  );
}
