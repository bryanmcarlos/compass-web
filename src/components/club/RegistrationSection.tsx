"use client";

import Link from "next/link";
import { Lock, CheckSquare } from "lucide-react";
import { useDriveRegistration } from "@/components/club/DriveRegistrationContext";
import { RegisterDriveForm } from "@/components/club/RegisterDriveForm";
import { UnregisterButton } from "@/components/club/UnregisterButton";
import type { RegistrationRole } from "@/lib/driveRoles";

/** Owns the same branching the drive detail page used to render inline —
 * moved into a Client Component so the "registered ⟷ register form" toggle
 * (and the closed/completed gate above it) reads from the shared
 * DriveRegistrationContext instead of the static server props, flipping
 * instantly on register/unregister/status-change instead of waiting for
 * the full revalidation round-trip. The truly-static branches (signed out,
 * under rank, no available role) are unaffected by any of those actions,
 * so they still key off plain props exactly as before. */
export function RegistrationSection({
  driveId,
  targetRank,
  requiredRankTitle,
  userRank,
  userRankTitle,
  availableRoles,
  hasCamp,
  profileComplete,
  initialMobileNumber,
  initialCarDetails,
}: {
  driveId: string;
  targetRank: number;
  requiredRankTitle: string | undefined;
  userRank: number | null;
  userRankTitle: string | undefined;
  availableRoles: RegistrationRole[];
  hasCamp: boolean;
  profileComplete: boolean;
  initialMobileNumber: string | null;
  initialCarDetails: string | null;
}) {
  const context = useDriveRegistration();
  // No provider above this (shouldn't happen in practice — the page always
  // wraps this — but fails safe rather than crashing if it's ever reused
  // without one): nothing renders rather than showing stale-forever state.
  if (!context) return null;
  const { state } = context;

  if (state.status !== "Scheduled" || state.registrationClosed) {
    return (
      <section className="rounded-2xl border border-sand bg-sand-light px-5 py-4 text-center text-sm text-charcoal-light/80">
        {state.status !== "Scheduled"
          ? `Registration is closed — this drive is marked ${state.status}.`
          : "Registration for this drive is closed."}
      </section>
    );
  }

  if (state.registration) {
    return (
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-forest/30 bg-forest/10 px-5 py-5 text-center">
        <span className="flex items-center gap-2 text-sm font-medium text-forest-dark">
          <CheckSquare className="h-4 w-4 shrink-0" />
          You&apos;re registered for this drive as {state.registration.role}.
        </span>
        <UnregisterButton driveId={driveId} />
      </section>
    );
  }

  if (userRank === null) {
    return (
      <section className="flex flex-col items-center gap-3 rounded-2xl border border-sand bg-off-white px-5 py-6 text-center shadow-sm">
        <button
          type="button"
          disabled
          className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sand-dark/40 px-4 py-2.5 text-sm font-semibold text-charcoal-light/60"
        >
          <Lock className="h-4 w-4" />
          Register for Drive
        </button>
        <p className="text-sm text-charcoal-light/80">
          <Link href="/login" className="font-semibold text-forest hover:underline">
            Sign in
          </Link>{" "}
          to register for this drive.
        </p>
      </section>
    );
  }

  if (userRank !== 0 && userRank < targetRank) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-sand bg-off-white px-5 py-6 text-center shadow-sm">
        <button
          type="button"
          disabled
          className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sand-dark/40 px-4 py-2.5 text-sm font-semibold text-charcoal-light/60"
        >
          <Lock className="h-4 w-4" />
          Register for Drive
        </button>
        <p className="max-w-sm text-sm text-charcoal-light/80">
          Locked: Required Rank {requiredRankTitle ?? targetRank}. Your current rank is{" "}
          {userRankTitle ?? userRank}.
        </p>
      </section>
    );
  }

  if (availableRoles.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-2xl border border-sand bg-off-white px-5 py-6 text-center shadow-sm">
        <button
          type="button"
          disabled
          className="flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-sand-dark/40 px-4 py-2.5 text-sm font-semibold text-charcoal-light/60"
        >
          <Lock className="h-4 w-4" />
          Register for Drive
        </button>
        <p className="max-w-sm text-sm text-charcoal-light/80">
          Your rank ({userRankTitle ?? userRank}) doesn&apos;t have an available role on this
          drive.
        </p>
      </section>
    );
  }

  return (
    <RegisterDriveForm
      driveId={driveId}
      availableRoles={availableRoles}
      hasCamp={hasCamp}
      profileComplete={profileComplete}
      initialMobileNumber={initialMobileNumber}
      initialCarDetails={initialCarDetails}
    />
  );
}
