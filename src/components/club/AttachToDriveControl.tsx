"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Link2,
  Unlink,
  Search,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  CalendarDays,
  UserRound,
} from "lucide-react";
import { linkTripReportToDrive } from "@/app/(app)/trip-reports/actions";
import { formatDate } from "@/lib/format";

export type PastDrive = {
  id: string;
  title: string;
  drive_date: string;
  lead_marshal: { username: string; full_name: string | null } | null;
};

/** Restricted to the report's author or a Super Admin — the page rendering
 * this already gates on that before mounting it; the Server Action
 * re-checks it independently regardless. */
export function AttachToDriveControl({
  reportId,
  currentDriveId,
  pastDrives,
}: {
  reportId: string;
  currentDriveId: string | null;
  pastDrives: PastDrive[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pastDrives;
    return pastDrives.filter((d) => d.title.toLowerCase().includes(q));
  }, [pastDrives, query]);

  function handleLink(driveId: string | null) {
    setMessage(null);
    startTransition(async () => {
      const result = await linkTripReportToDrive(reportId, driveId);
      setMessage({
        type: result.status === "error" ? "error" : "success",
        text: result.message ?? "",
      });
      if (result.status === "success") {
        setIsOpen(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-sand bg-off-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-charcoal">
          <Link2 className="h-4 w-4 text-forest" />
          {currentDriveId ? "Linked Drive" : "Not Attached to a Drive"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-off-white px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            <Link2 className="h-3.5 w-3.5" />
            {currentDriveId ? "Change Linked Drive" : "Attach to an Event"}
          </button>
          {currentDriveId && (
            <button
              type="button"
              onClick={() => handleLink(null)}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-error/30 bg-off-white px-3 py-1.5 text-xs font-semibold text-error transition-colors hover:bg-error-bg disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Unlink className="h-3.5 w-3.5" />
              Detach
            </button>
          )}
        </div>
      </div>

      {isOpen && (
        <div className="flex flex-col gap-2 border-t border-sand pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search completed drives…"
              className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
            />
          </div>

          <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-charcoal-light/60">
                No completed drives match your search.
              </p>
            ) : (
              filtered.map((drive) => (
                <button
                  key={drive.id}
                  type="button"
                  onClick={() => handleLink(drive.id)}
                  disabled={isPending || drive.id === currentDriveId}
                  className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                    drive.id === currentDriveId
                      ? "border-primary/40 bg-primary/5"
                      : "border-sand hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <span className="font-medium text-charcoal">{drive.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-charcoal-light/70">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(drive.drive_date)}
                    </span>
                    {drive.lead_marshal && (
                      <span className="flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {drive.lead_marshal.full_name ?? drive.lead_marshal.username}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {isPending && (
        <p className="flex items-center gap-1.5 text-xs text-charcoal-light/70">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          Saving…
        </p>
      )}
      {message && (
        <p
          className={`flex items-center gap-1.5 text-xs ${
            message.type === "error" ? "text-error" : "text-forest-dark"
          }`}
        >
          {message.type === "error" ? (
            <CircleAlert className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CircleCheck className="h-3.5 w-3.5 shrink-0" />
          )}
          {message.text}
        </p>
      )}
    </div>
  );
}
