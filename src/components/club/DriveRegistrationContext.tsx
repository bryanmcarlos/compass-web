"use client";

import { createContext, useContext, useOptimistic, type ReactNode } from "react";
import type { RegistrationRole } from "@/lib/driveRoles";
import type { DriveStatus } from "@/components/club/DriveBadges";

export type DriveRegistrationState = {
  driverCount: number;
  registration: { role: RegistrationRole } | null;
  status: DriveStatus;
  registrationClosed: boolean;
};

type ContextValue = {
  state: DriveRegistrationState;
  optimisticallyRegister: (role: RegistrationRole) => void;
  optimisticallyUnregister: () => void;
  optimisticallySetStatus: (status: DriveStatus) => void;
  optimisticallySetRegistrationClosed: (closed: boolean) => void;
};

const DriveRegistrationContext = createContext<ContextValue | null>(null);

/** Register/unregister already show an instant spinner on their own button
 * — the real gap this closes is everything ELSE on the page that reflects
 * the same fact (DriveHero's seat count and status badge, the "registration
 * closed" message, the Marshal quick-action panel) staying stale until the
 * full revalidatePath + RSC round-trip completes. One shared useOptimistic
 * here, three-ish visually-separated consumers, instead of three separate
 * pieces of state that'd disagree with each other mid-transition.
 *
 * Server Components can still be passed through as `children` of this
 * provider without themselves becoming client-rendered — only components
 * that actually call useDriveRegistration() need their own 'use client'. */
export function DriveRegistrationProvider({
  initialDriverCount,
  initialRegistration,
  initialStatus,
  initialRegistrationClosed,
  children,
}: {
  initialDriverCount: number;
  initialRegistration: { role: RegistrationRole } | null;
  initialStatus: DriveStatus;
  initialRegistrationClosed: boolean;
  children: ReactNode;
}) {
  const [state, setOptimisticState] = useOptimistic<
    DriveRegistrationState,
    Partial<DriveRegistrationState>
  >(
    {
      driverCount: initialDriverCount,
      registration: initialRegistration,
      status: initialStatus,
      registrationClosed: initialRegistrationClosed,
    },
    (current, update) => ({ ...current, ...update }),
  );

  // Approximate — a real driver-slot count also depends on the registrant's
  // rank (countsAsDriverSlot's Marshal-Supporting exception), which isn't
  // known client-side without extra data. Good enough for the brief window
  // before revalidation lands the real, server-verified count; Lead never
  // counted as a driver slot even before this.
  function optimisticallyRegister(role: RegistrationRole) {
    setOptimisticState({
      registration: { role },
      driverCount: role === "Lead" ? state.driverCount : state.driverCount + 1,
    });
  }

  function optimisticallyUnregister() {
    const hadDriverSlot = state.registration && state.registration.role !== "Lead";
    setOptimisticState({
      registration: null,
      driverCount: hadDriverSlot ? Math.max(state.driverCount - 1, 0) : state.driverCount,
    });
  }

  function optimisticallySetStatus(status: DriveStatus) {
    setOptimisticState({ status });
  }

  function optimisticallySetRegistrationClosed(closed: boolean) {
    setOptimisticState({ registrationClosed: closed });
  }

  return (
    <DriveRegistrationContext.Provider
      value={{
        state,
        optimisticallyRegister,
        optimisticallyUnregister,
        optimisticallySetStatus,
        optimisticallySetRegistrationClosed,
      }}
    >
      {children}
    </DriveRegistrationContext.Provider>
  );
}

/** Returns null outside a provider (rather than throwing) so a component
 * that only sometimes renders inside one — DriveHero, reused wherever —
 * can fall back to its plain server-fetched props instead of crashing. */
export function useDriveRegistration(): ContextValue | null {
  return useContext(DriveRegistrationContext);
}
