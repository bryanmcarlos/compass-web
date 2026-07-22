/**
 * Drive registration role-eligibility rules. Pure and framework-free so the
 * exact same logic can run in the Server Component (to decide what to show),
 * the Server Action (to re-validate what was submitted), and the client form
 * (to render the right dropdown) without three separate implementations
 * drifting apart.
 *
 * Callers are expected to have already enforced the existing "current_rank
 * must be >= drive.target_rank to reach this at all" gate — these rules
 * assume that's already true and don't re-derive it.
 */

import { rankNameFromLevel } from "@/lib/constants";

export type RegistrationRole = "Driver" | "Support" | "Lead";

export const ALL_REGISTRATION_ROLES: RegistrationRole[] = ["Driver", "Support", "Lead"];

export type RoleEligibilityInput = {
  currentRank: number;
  isMit: boolean;
  /** MIN(allowedRanks) — kept alongside allowedRanks for the branches below
   * that are about relative seniority (a senior member Supporting a junior
   * drive), not direct tier-matching. Those didn't need to change when
   * drives became multi-rank. */
  targetRank: number;
  /** The drive's full set of Driver-eligible rank levels (e.g. [1, 2] for a
   * Newbie+Rookie drive). Ignored when isAllLevels is true. */
  allowedRanks: number[];
  isAllLevels: boolean;
  /** Is at least one full Marshal (rank 5) already registered as 'Support' on this drive? */
  hasSupervisingMarshal: boolean;
};

/**
 * Returns the role(s) this member is allowed to register as for this drive,
 * in priority/display order. An empty array means they have no valid role
 * here at all (e.g. a Rookie on a Newbie-only drive: too senior to be a
 * Driver, too junior to Support). Rank 0 (Member) always falls through to
 * the default case here — Member eligibility is a separate policy overlay
 * (see checkMemberEligibleForDrive in drives/[id]/actions.ts), not part of
 * this rank-hierarchy function.
 */
export function getAvailableRoles({
  currentRank,
  isMit,
  targetRank,
  allowedRanks,
  isAllLevels,
  hasSupervisingMarshal,
}: RoleEligibilityInput): RegistrationRole[] {
  switch (currentRank) {
    case 5: // Marshal — always a Lead or Support option, never a plain Driver.
      return ["Lead", "Support"];

    case 4: // Advanced
      if (isMit) {
        return hasSupervisingMarshal ? ["Support", "Lead"] : ["Support"];
      }
      return ["Support"];

    case 3: // Intermediate
      if (isAllLevels || allowedRanks.includes(3)) return ["Driver"];
      if (targetRank < 3) return ["Support"];
      return [];

    case 2: // Rookie
    case 1: // Newbie
      return isAllLevels || allowedRanks.includes(currentRank) ? ["Driver"] : [];

    default:
      return [];
  }
}

/** A registration counts toward a drive's active "driver slot" numerator
 * (the "10/18 Drivers Registered" figure) when it's a Driver, or a Support
 * registration from someone who isn't a full Marshal — an Advanced member
 * Supporting a drive is still occupying a driver-equivalent seat, but a
 * Marshal Supporting isn't. Uses the same driver_rank-with-current_rank-
 * fallback resolution as the roster grouping in ConvoyRosterTab. */
export function countsAsDriverSlot(
  role: RegistrationRole,
  driverRank: string | null,
  currentRank: number,
): boolean {
  if (role === "Driver") return true;
  if (role !== "Support") return false;
  return (driverRank ?? rankNameFromLevel(currentRank)) !== "Marshal";
}
