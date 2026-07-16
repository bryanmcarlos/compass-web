"use client";

import { useActionState } from "react";
import { Phone, Car, Save, LoaderCircle, CircleCheck, CircleAlert } from "lucide-react";
import {
  updateProfile,
  type UpdateProfileState,
} from "@/app/(app)/profile/actions";

const initialState: UpdateProfileState = { status: "idle", message: null };

export function EditProfileForm({
  mobileNumber,
  carDetails,
}: {
  mobileNumber: string | null;
  carDetails: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateProfile,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-sand bg-off-white p-6 shadow-sm sm:p-8"
    >
      <header>
        <h2 className="text-lg font-semibold text-charcoal">
          Profile Settings
        </h2>
        <p className="text-sm text-charcoal-light/80">
          Keep your contact and vehicle details current for drive signups.
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="mobileNumber"
          className="text-sm font-medium text-charcoal"
        >
          Mobile Number
        </label>
        <div className="relative">
          <Phone className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          <input
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            defaultValue={mobileNumber ?? ""}
            placeholder="+9715XXXXXXXX"
            className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="carDetails"
          className="text-sm font-medium text-charcoal"
        >
          Car Details
        </label>
        <div className="relative">
          <Car className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-charcoal-light/60" />
          <input
            id="carDetails"
            name="carDetails"
            type="text"
            defaultValue={carDetails ?? ""}
            placeholder="e.g. Wrangler Rubicon JL"
            maxLength={100}
            className="w-full rounded-lg border border-sand bg-off-white py-2 pr-3 pl-9 text-base text-charcoal placeholder:text-charcoal-light/40 focus:border-forest focus:ring-2 focus:ring-forest/20 focus:outline-none"
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
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-off-white transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-70"
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
