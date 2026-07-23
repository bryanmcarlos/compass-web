"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Send,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  TriangleAlert,
  Tent,
  Phone,
  Car,
  X,
} from "lucide-react";
import {
  registerForDrive,
  type RegisterDriveState,
} from "@/app/(app)/drives/[id]/actions";
import { updateProfile, type UpdateProfileState } from "@/app/(app)/profile/actions";
import type { RegistrationRole } from "@/lib/driveRoles";

const initialState: RegisterDriveState = { status: "idle", message: null };
const profileInitialState: UpdateProfileState = { status: "idle", message: null };

export const WAIVER_TEXT =
  "I am fully aware of the dangers & risks inherent in participating in this event. I am physically fit and have agreed to participate voluntarily out of my will and volition. I agree to give up all my rights to take any legal action or sue anyone associated with the COMPASS Committee.";

export function RegisterDriveForm({
  driveId,
  availableRoles,
  hasCamp,
  profileComplete,
  initialMobileNumber,
  initialCarDetails,
}: {
  driveId: string;
  /** Roles this member is eligible for on this drive, from `getAvailableRoles`.
   *  Always at least one — the caller should show a different message instead
   *  of this form when it's empty. */
  availableRoles: RegistrationRole[];
  /** Whether this drive offers optional camping — shows the RSVP checkbox when true. */
  hasCamp: boolean;
  /** True when the member's profile already has both mobile_number and
   * car_details set. False intercepts the first submit attempt with a modal
   * instead of registering — the roster depends on both being real. */
  profileComplete: boolean;
  initialMobileNumber: string | null;
  initialCarDetails: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    registerForDrive,
    initialState,
  );
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [role, setRole] = useState<RegistrationRole>(availableRoles[0]);
  const [joiningCamp, setJoiningCamp] = useState(false);

  const isDone = state.status === "success";

  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Mirrors `profileComplete` but flips true client-side the moment the
  // profile-completion modal saves successfully, so the resubmitted form
  // isn't intercepted a second time.
  const [profileConfirmed, setProfileConfirmed] = useState(profileComplete);
  const [gateOpen, setGateOpen] = useState(false);
  const [profileState, profileFormAction, profilePending] = useActionState(
    updateProfile,
    profileInitialState,
  );

  useEffect(() => {
    if (gateOpen) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [gateOpen]);

  useEffect(() => {
    if (profileState.status === "success") {
      // Syncing local state to an async external event (the profile-update
      // action's result) — not a redundant derivation from already-available
      // render-time state, so this is the legitimate exception the lint
      // rule can't tell apart from the general "don't setState in an
      // effect" heuristic. Same reasoning as DriveForm's re-sync effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileConfirmed(true);
      setGateOpen(false);
      // Re-submit the real registration now that the profile gate is
      // cleared — reads as one action to the member, not two.
      formRef.current?.requestSubmit();
    }
  }, [profileState.status]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!profileConfirmed) {
      e.preventDefault();
      setGateOpen(true);
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-5 shadow-sm"
    >
      <input type="hidden" name="driveId" value={driveId} />

      <dialog
        ref={dialogRef}
        onClose={() => setGateOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setGateOpen(false);
        }}
        className="m-auto w-full max-w-sm rounded-2xl border border-sand bg-off-white p-0 shadow-sm backdrop:bg-charcoal/50"
      >
        <form action={profileFormAction} className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-charcoal">
              Add Your Contact &amp; Vehicle Details
            </h2>
            <button
              type="button"
              onClick={() => setGateOpen(false)}
              aria-label="Close"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-charcoal-light/60 hover:bg-sand-light"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-charcoal-light/70">
            The convoy roster shows this for every driver — needed before you can register.
          </p>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="gateMobileNumber" className="text-sm font-medium text-charcoal">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
              <input
                id="gateMobileNumber"
                name="mobileNumber"
                type="tel"
                required
                defaultValue={initialMobileNumber ?? ""}
                placeholder="05XXXXXXXX or +9715XXXXXXXX"
                className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="gateCarDetails" className="text-sm font-medium text-charcoal">
              Car Details
            </label>
            <div className="relative">
              <Car className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
              <input
                id="gateCarDetails"
                name="carDetails"
                type="text"
                required
                defaultValue={initialCarDetails ?? ""}
                placeholder="e.g. Wrangler Rubicon JL"
                maxLength={100}
                className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
              />
            </div>
          </div>

          {profileState.status === "error" && profileState.message && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-error/30 bg-error-bg p-3 text-sm text-error"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{profileState.message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={profilePending}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {profilePending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {profilePending ? "Saving…" : "Save & Continue to Register"}
          </button>
        </form>
      </dialog>

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
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
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
