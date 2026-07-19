"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { UserPlus, Search, LoaderCircle, CircleCheck, CircleAlert, X } from "lucide-react";
import {
  searchAssignableMembers,
  assignMemberToSlot,
  type AssignableMember,
  type AssignSlotState,
} from "@/app/(app)/drives/[id]/assignActions";
import { getAvailableRoles, type RegistrationRole } from "@/lib/driveRoles";
import { WAIVER_TEXT } from "./RegisterDriveForm";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";

const initialState: AssignSlotState = { status: "idle", message: null };

/** Admin-only "fill this open slot" flow, reachable from an empty Driver
 * slot in the Signup Sheet. The trigger is always rendered — callers only
 * mount this component at all when the viewer is already known to be a
 * Super User, same gating convention as the rest of this page's admin-only
 * affordances (e.g. the WhatsApp quick action). */
export function AssignDriverSlotModal({
  driveId,
  driveTitle,
  slotLabel,
  targetRank,
  hasSupervisingMarshal,
}: {
  driveId: string;
  driveTitle: string;
  slotLabel: string;
  targetRank: number;
  hasSupervisingMarshal: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssignableMember[]>([]);
  const [selected, setSelected] = useState<AssignableMember | null>(null);
  const [role, setRole] = useState<RegistrationRole | "">("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [attested, setAttested] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const [state, formAction, isSaving] = useActionState(assignMemberToSlot, initialState);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  // Closing on a successful save is "adjusting state during render" (per
  // React's own guidance for this exact case) rather than an Effect — a
  // plain `useState` tracker for the last-seen status, not a ref (refs
  // can't be read/written during render), avoids the setState-in-Effect
  // cascading-render footgun for a transition that's really just derived
  // from `state` itself.
  const [prevStatus, setPrevStatus] = useState(state.status);
  if (state.status !== prevStatus) {
    setPrevStatus(state.status);
    if (state.status === "success" && isOpen) {
      setIsOpen(false);
    }
  }

  // Live search — debounced, and only while the dialog is actually open.
  // The sub-2-character case is handled by `visibleResults` below rather
  // than clearing `results` here, so this effect only ever sets state from
  // inside its async callback, never synchronously in the effect body.
  useEffect(() => {
    if (!isOpen) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timeout = setTimeout(() => {
      startSearch(async () => {
        const result = await searchAssignableMembers(driveId, trimmed);
        setResults(result.status === "success" ? result.results : []);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, driveId, isOpen]);

  const trimmedQuery = query.trim();
  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  function resetAndClose() {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSelected(null);
    setRole("");
    setMobileNumber("");
    setVehicleDetails("");
    setAttested(false);
  }

  function handleSelect(member: AssignableMember) {
    setSelected(member);
    const roles = getAvailableRoles({
      currentRank: member.current_rank,
      isMit: member.is_mit,
      targetRank,
      hasSupervisingMarshal,
    });
    setRole(roles.includes("Driver") ? "Driver" : (roles[0] ?? ""));
    setMobileNumber(member.mobile_number ?? "");
    setVehicleDetails(member.car_details ?? "");
  }

  const eligibleRoles = selected
    ? getAvailableRoles({
        currentRank: selected.current_rank,
        isMit: selected.is_mit,
        targetRank,
        hasSupervisingMarshal,
      })
    : [];

  const canSave = selected !== null && role !== "" && attested && !isSaving;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-1.5 text-sm text-charcoal-light/50 italic transition-colors hover:text-forest hover:not-italic"
      >
        <UserPlus className="h-4 w-4 shrink-0" />
        Open slot — click to assign
      </button>

      <dialog
        ref={dialogRef}
        onClose={resetAndClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) resetAndClose();
        }}
        className="m-auto w-full max-w-md rounded-2xl border border-sand bg-off-white p-0 shadow-sm backdrop:bg-charcoal/50"
      >
        <form action={formAction} className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5">
          <input type="hidden" name="driveId" value={driveId} />
          <input type="hidden" name="memberId" value={selected?.id ?? ""} />

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-charcoal">
              Assign {slotLabel} — {driveTitle}
            </h2>
            <button
              type="button"
              onClick={resetAndClose}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-light/60 hover:bg-sand-light"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {!selected ? (
            <div className="flex flex-col gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by username or name…"
                  autoFocus
                  className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
                />
              </div>
              <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto">
                {isSearching && (
                  <p className="flex items-center gap-1.5 px-2 py-3 text-xs text-charcoal-light/60">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    Searching…
                  </p>
                )}
                {!isSearching && trimmedQuery.length >= 2 && visibleResults.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-charcoal-light/60">
                    No members match &ldquo;{trimmedQuery}&rdquo;.
                  </p>
                )}
                {visibleResults.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleSelect(member)}
                    className="flex items-center gap-3 rounded-lg border border-sand px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5"
                  >
                    <Avatar
                      name={member.full_name ?? member.username}
                      avatarUrl={member.avatar_url}
                      className="h-8 w-8 text-xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-charcoal">
                        {member.full_name ?? member.username}
                      </span>
                      <span className="block truncate text-xs text-charcoal-light/60">
                        @{member.username}
                      </span>
                    </span>
                    <RankBadge rank={member.current_rank} className="shrink-0 text-[11px]" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <Avatar
                  name={selected.full_name ?? selected.username}
                  avatarUrl={selected.avatar_url}
                  className="h-8 w-8 text-xs"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-charcoal">
                    {selected.full_name ?? selected.username}
                  </span>
                  <span className="block truncate text-xs text-charcoal-light/60">
                    @{selected.username}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="shrink-0 text-xs font-medium text-forest hover:underline"
                >
                  Change
                </button>
              </div>

              {eligibleRoles.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-error">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  {selected.full_name ?? selected.username}&apos;s rank doesn&apos;t qualify for
                  any role on this drive.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="role" className="text-sm font-medium text-charcoal">
                    Role
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as RegistrationRole)}
                    className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
                  >
                    {eligibleRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="mobileNumber" className="text-sm font-medium text-charcoal">
                  Mobile Number
                </label>
                <input
                  id="mobileNumber"
                  name="mobileNumber"
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  placeholder="e.g. 0501234567"
                  className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
                />
                <p className="text-xs text-charcoal-light/60">
                  Saved to {selected.full_name ?? selected.username}&apos;s profile if changed.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="vehicleDetails" className="text-sm font-medium text-charcoal">
                  Vehicle Details
                </label>
                <input
                  id="vehicleDetails"
                  name="vehicleDetails"
                  type="text"
                  value={vehicleDetails}
                  onChange={(e) => setVehicleDetails(e.target.value)}
                  placeholder="e.g. White JKU Wrangler"
                  className="rounded-lg border border-sand bg-off-white px-3 py-2 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
                />
                <p className="text-xs text-charcoal-light/60">
                  Pre-filled from their saved profile — only applies to this drive&apos;s
                  registration, won&apos;t overwrite their profile default.
                </p>
              </div>

              <label className="flex items-start gap-2 rounded-lg border border-sand bg-sand-light/50 p-3 text-xs text-charcoal-light/90">
                <input
                  type="checkbox"
                  name="attested"
                  checked={attested}
                  onChange={(e) => setAttested(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
                />
                <span>
                  I confirm this member has accepted the waiver below on their behalf:{" "}
                  <span className="text-charcoal-light/70 italic">{WAIVER_TEXT}</span>
                </span>
              </label>

              {state.status === "error" && (
                <p className="flex items-center gap-1.5 text-sm text-error">
                  <CircleAlert className="h-4 w-4 shrink-0" />
                  {state.message}
                </p>
              )}

              <button
                type="submit"
                disabled={!canSave}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <CircleCheck className="h-4 w-4" />
                )}
                Save Assignment
              </button>
            </div>
          )}
        </form>
      </dialog>
    </>
  );
}
