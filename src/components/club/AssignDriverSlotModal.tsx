"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Search, LoaderCircle, CircleCheck, CircleAlert, X } from "lucide-react";
import {
  searchAssignableMembers,
  assignMemberToSlot,
  updateAssignedMember,
  type AssignableMember,
  type AssignSlotState,
} from "@/app/(app)/drives/[id]/assignActions";
import { getAvailableRoles, ALL_REGISTRATION_ROLES, type RegistrationRole } from "@/lib/driveRoles";
import { WAIVER_TEXT } from "./RegisterDriveForm";
import { Avatar } from "./Avatar";
import { RankBadge } from "./RankBadge";
import { rankNameFromLevel } from "@/lib/constants";

const initialState: AssignSlotState = { status: "idle", message: null };

/** Local-date (not UTC) "YYYY-MM-DD" — mirrors the same helper in
 * assignActions.ts so the client-side dropdown pre-filter and the server's
 * independent re-validation agree on what counts as "historical." */
function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Static, accurate-by-construction captions — not the actual enforcement
// (that's always getAvailableRoles, re-validated server-side regardless of
// what this component shows), just a plain-language explanation of why a
// role is missing from the dropdown for the selected member.
const ROLE_REQUIREMENT: Record<RegistrationRole, string> = {
  Lead: "requires Marshal rank (or a supervised Marshal-in-Training)",
  Support: "requires Intermediate or Advanced rank (or MIT)",
  Driver: "requires the member's rank to match this drive's target rank",
};

type CommonProps = {
  driveId: string;
  driveTitle: string;
  /** Postgres date string, e.g. "2026-07-15". Used only to relax rank
   * guardrails for drives already in the past (backdating a record for a
   * member who's since been promoted) — never to bypass them for an
   * upcoming or in-progress drive. */
  driveDate: string;
  targetRank: number;
  allowedRanks: number[];
  isAllLevels: boolean;
  hasSupervisingMarshal: boolean;
  /** Caller-supplied clickable content — an empty-slot placeholder, an
   * existing participant row, or a standalone "Add Participant" button.
   * Wrapped in a layout-transparent button so it never fights the caller's
   * own flex/grid context. */
  trigger: ReactNode;
};

type Props =
  | (CommonProps & { mode: "add" })
  | (CommonProps & {
      mode: "edit";
      registrationId: string;
      currentRole: RegistrationRole;
      member: AssignableMember;
    });

/** Admin-only "fill or edit a drive assignment" flow. In "add" mode it
 * starts at a member search; in "edit" mode it opens straight into the
 * form, pre-filled from an existing registration, with no search step and
 * no waiver re-attestation (the member's original acceptance already
 * covers them — this path only ever changes role/contact/vehicle info). */
export function AssignDriverSlotModal(props: Props) {
  const {
    driveId,
    driveTitle,
    driveDate,
    targetRank,
    allowedRanks,
    isAllLevels,
    hasSupervisingMarshal,
    trigger,
    mode,
  } = props;
  const isHistoricalDrive = driveDate < todayIsoDate();

  // Best-effort client preview only — the server independently re-validates
  // regardless (including, for a Member, a "no other active Newbie
  // registration" check this client-side preview can't do without a round
  // trip). A Member (rank 0) always falls through getAvailableRoles'
  // default case, so it's special-cased here the same way the server
  // special-cases it before ever calling that function.
  function previewRolesFor(member: AssignableMember): RegistrationRole[] {
    if (isHistoricalDrive) return ALL_REGISTRATION_ROLES;
    if (member.current_rank === 0) return ["Driver"];
    return getAvailableRoles({
      currentRank: member.current_rank,
      isMit: member.is_mit,
      targetRank,
      allowedRanks,
      isAllLevels,
      hasSupervisingMarshal,
    });
  }

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssignableMember[]>([]);
  const [selected, setSelected] = useState<AssignableMember | null>(
    mode === "edit" ? props.member : null,
  );
  const [role, setRole] = useState<RegistrationRole | "">(mode === "edit" ? props.currentRole : "");
  const [mobileNumber, setMobileNumber] = useState(
    mode === "edit" ? (props.member.mobile_number ?? "") : "",
  );
  const [vehicleDetails, setVehicleDetails] = useState(
    mode === "edit" ? (props.member.car_details ?? "") : "",
  );
  const [attested, setAttested] = useState(false);
  const [isSearching, startSearch] = useTransition();
  const action = mode === "add" ? assignMemberToSlot : updateAssignedMember;
  const [state, formAction, isSaving] = useActionState(action, initialState);

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
    if (!isOpen || mode !== "add") return;
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const timeout = setTimeout(() => {
      startSearch(async () => {
        const result = await searchAssignableMembers(driveId, trimmed);
        setResults(result.status === "success" ? result.results : []);
      });
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, driveId, isOpen, mode]);

  const trimmedQuery = query.trim();
  const visibleResults = trimmedQuery.length < 2 ? [] : results;

  function resetAndClose() {
    setIsOpen(false);
    if (mode === "add") {
      setQuery("");
      setResults([]);
      setSelected(null);
      setRole("");
      setMobileNumber("");
      setVehicleDetails("");
      setAttested(false);
    }
  }

  function handleSelect(member: AssignableMember) {
    setSelected(member);
    const roles = previewRolesFor(member);
    setRole(roles.includes("Driver") ? "Driver" : (roles[0] ?? ""));
    setMobileNumber(member.mobile_number ?? "");
    setVehicleDetails(member.car_details ?? "");
  }

  const eligibleRoles = selected ? previewRolesFor(selected) : [];
  const missingRoles = isHistoricalDrive
    ? []
    : ALL_REGISTRATION_ROLES.filter((r) => !eligibleRoles.includes(r));

  const canSave =
    selected !== null && role !== "" && !isSaving && (mode === "edit" || attested);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="contents cursor-pointer">
        {trigger}
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
          {mode === "edit" && (
            <input type="hidden" name="registrationId" value={props.registrationId} />
          )}

          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-charcoal">
              {mode === "add" ? "Add Participant" : "Edit Assignment"} — {driveTitle}
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

          {mode === "add" && !selected ? (
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
                    <RankBadge
                      rank={rankNameFromLevel(member.current_rank)}
                      className="shrink-0 text-[11px]"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : selected ? (
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
                {mode === "add" && (
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="shrink-0 text-xs font-medium text-forest hover:underline"
                  >
                    Change
                  </button>
                )}
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
                  {isHistoricalDrive ? (
                    <p className="text-xs text-charcoal-light/60">
                      This drive already happened — rank guardrails are relaxed so members can
                      be backdated into their actual historical role.
                    </p>
                  ) : (
                    missingRoles.length > 0 && (
                      <p className="text-xs text-charcoal-light/60">
                        Not available for this member:{" "}
                        {missingRoles.map((r, i) => (
                          <span key={r}>
                            {i > 0 && "; "}
                            <span className="font-medium">{r}</span> ({ROLE_REQUIREMENT[r]})
                          </span>
                        ))}
                        .
                      </p>
                    )
                  )}
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
                  Saved to this drive&apos;s registration and to{" "}
                  {selected.full_name ?? selected.username}&apos;s profile if changed.
                </p>
              </div>

              {mode === "add" && (
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
              )}

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
                {mode === "add" ? "Save Assignment" : "Update Assignment"}
              </button>
            </div>
          ) : null}
        </form>
      </dialog>
    </>
  );
}
