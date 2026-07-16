"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Send,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  Tent,
} from "lucide-react";
import {
  registerForDrive,
  type RegisterDriveState,
} from "@/app/(app)/drives/[id]/actions";
import type { RegistrationRole } from "@/lib/driveRoles";

const initialState: RegisterDriveState = { status: "idle", message: null };

const WAIVER_TEXT =
  "I am fully aware of the dangers & risks inherent in participating in this event. I am physically fit and have agreed to participate voluntarily out of my will and volition. I agree to give up all my rights to take any legal action or sue anyone associated with the COMPASS Committee.";

export function RegisterDriveForm({
  driveId,
  availableRoles,
  hasCamp,
}: {
  driveId: string;
  /** Roles this member is eligible for on this drive, from `getAvailableRoles`.
   *  Always at least one — the caller should show a different message instead
   *  of this form when it's empty. */
  availableRoles: RegistrationRole[];
  /** Whether this drive offers optional camping — shows the RSVP checkbox when true. */
  hasCamp: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    registerForDrive,
    initialState,
  );
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [role, setRole] = useState<RegistrationRole>(availableRoles[0]);
  const [joiningCamp, setJoiningCamp] = useState(false);

  const isDone = state.status === "success";

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm"
    >
      <input type="hidden" name="driveId" value={driveId} />

      {availableRoles.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role" className="text-sm font-medium text-charcoal">
            Join as
          </label>
          <select
            id="role"
            name="role"
            required
            value={role}
            onChange={(e) => setRole(e.target.value as RegistrationRole)}
            className="w-full rounded-lg border border-sand bg-off-white py-2 px-3 text-base text-charcoal focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <input type="hidden" name="role" value={availableRoles[0]} />
          <p className="text-sm text-charcoal-light/80">
            You&apos;ll register as{" "}
            <span className="font-semibold text-charcoal">
              {availableRoles[0]}
            </span>
            .
          </p>
        </>
      )}

      {hasCamp && (
        <label className="flex items-center gap-2.5 rounded-lg border border-sand bg-sand-light px-3 py-3 text-sm text-charcoal">
          <input
            type="checkbox"
            name="joiningCamp"
            checked={joiningCamp}
            onChange={(e) => setJoiningCamp(e.target.checked)}
            className="h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
          />
          <span className="flex items-center gap-1.5">
            <Tent className="h-4 w-4 text-forest" />
            ⛺ Joining for Camping?
          </span>
        </label>
      )}

      <p className="text-xs text-charcoal-light/70">
        The roster shows your car and mobile number from{" "}
        <Link href="/profile" className="font-medium text-forest hover:underline">
          your profile
        </Link>
        — keep those up to date so other members can reach you.
      </p>

      <label className="flex items-start gap-2.5 rounded-lg border border-sand bg-sand-light px-3 py-3 text-xs text-charcoal-light/90">
        <input
          type="checkbox"
          name="acceptedWaiver"
          required
          checked={waiverAccepted}
          onChange={(e) => setWaiverAccepted(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-sand text-forest focus:ring-2 focus:ring-forest/20"
        />
        <span className="flex flex-col gap-1">
          <span className="flex items-center gap-1.5 font-semibold text-charcoal">
            <TriangleAlert className="h-3.5 w-3.5 text-error" />
            Waiver &amp; Release of Liability
          </span>
          {WAIVER_TEXT}
        </span>
      </label>

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
        disabled={pending || isDone || !waiverAccepted}
        className="flex items-center justify-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:bg-forest-dark disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {pending ? "Registering…" : isDone ? "Registered" : "Register for Drive"}
      </button>
    </form>
  );
}
