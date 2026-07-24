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

import { rankNameFromLevel, COMPASS_RANKS } from "@/lib/constants";

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
  /** Set (drives.exam_type) when this drive is the specific R1/R2/I1/I2/I3
   * exam event a Marshal accepted challenge submissions into — overrides
   * every rule below with its own, much narrower one. */
  examType?: string | null;
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
  examType,
}: RoleEligibilityInput): RegistrationRole[] {
  // An exam drive's whole point is testing the candidates a Marshal already
  // accepted onto it via the challenge-acceptance flow — the rank actually
  // being examined never gets a self-registration path here at all (a
  // Rookie can't just sign up for an R1 exam drive the way they would any
  // other drive), and everyone senior can only Support, never Drive or
  // Lead, since the driving is reserved for whoever's being tested. The
  // drive's own lead_marshal_id already covers "who's in charge," so
  // there's no Lead registration role to hand out here either.
  if (examType) {
    if (currentRank === targetRank) return [];
    return ["Support"];
  }

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

/** True when this drive covers `currentRank`'s curriculum "gated final
 * must-skill" (e.g. Intro to INT for a Rookie, Intro to ROK for a Newbie)
 * — the transition drive that's only supposed to happen after everything
 * else for that rank, including any exams, is already done. Pure/sync
 * flag only; the actual eligibility re-check (drives, must-skills, and any
 * exams passed+reported) is async — see checkGatedFinalSkillEligible in
 * drives/[id]/actions.ts. */
export function isGatedFinalDrive(
  mustSkillsCovered: string[] | null | undefined,
  currentRank: number,
): boolean {
  const gatedSkill = COMPASS_RANKS[currentRank as 1 | 2 | 3 | 4 | 5]?.gatedFinalMustSkill;
  return Boolean(gatedSkill && (mustSkillsCovered ?? []).includes(gatedSkill));
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
