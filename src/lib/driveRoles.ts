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

export type RegistrationRole = "Driver" | "Support" | "Lead";

export const ALL_REGISTRATION_ROLES: RegistrationRole[] = ["Driver", "Support", "Lead"];

export type RoleEligibilityInput = {
  currentRank: number;
  isMit: boolean;
  targetRank: number;
  /** Is at least one full Marshal (rank 5) already registered as 'Support' on this drive? */
  hasSupervisingMarshal: boolean;
};

/**
 * Returns the role(s) this member is allowed to register as for this drive,
 * in priority/display order. An empty array means they have no valid role
 * here at all (e.g. a Rookie on a Newbie-target drive: too senior to be the
 * target-rank Driver, too junior to Support).
 */
export function getAvailableRoles({
  currentRank,
  isMit,
  targetRank,
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
      if (targetRank === 3) return ["Driver"];
      if (targetRank < 3) return ["Support"];
      return [];

    case 2: // Rookie
    case 1: // Newbie
      return currentRank === targetRank ? ["Driver"] : [];

    default:
      return [];
  }
}
