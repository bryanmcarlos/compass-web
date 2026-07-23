/**
 * Single source of truth for club branding, theme, ranks, and rules.
 * A white-labeled deployment for a different club only needs to edit this
 * file (and its matching CSS custom properties in `app/globals.css`) — no
 * page or component should hardcode club identity, copy, or rank names.
 */

/** Display-name form of a rank, as used by RankBadge's image-based badges.
 * "General" never corresponds to a real current_rank value — it's the
 * fallback RankBadge renders for a missing/out-of-range level, distinct
 * from "Member" (a real rank: level 0, newly signed up / pending
 * approval). */
export type RankName =
  | "General"
  | "Member"
  | "Newbie"
  | "Rookie"
  | "Intermediate"
  | "Advanced"
  | "Marshal";

export function rankNameFromLevel(level: number | null | undefined): RankName {
  return (CLUB_CONFIG.ranks.find((r) => r.level === level)?.title as RankName | undefined) ?? "General";
}

export type RankLevel = {
  /** 0 = Member (newly signed up, pending approval), 5 = highest. */
  level: 0 | 1 | 2 | 3 | 4 | 5;
  title: string;
  description: string;
  /** CSS custom property (defined in `app/globals.css`) carrying this rank's mark color. */
  colorVar: string;
};

export type ClubConfig = {
  metadata: {
    name: string;
    shortName: string;
    tagline: string;
    /** Short phrases the brand is built around, e.g. shown under the homepage banner. */
    pillars: string[];
    logoUrl: string | null;
  };
  /**
   * Literal Tailwind class strings (not partial tokens) so Tailwind's static
   * scanner can see and generate them — never interpolate these into a
   * `bg-${...}` template, that string never reaches the scanner.
   */
  theme: {
    primary: string;
    primaryText: string;
    secondary: string;
    secondaryText: string;
    accentBg: string;
    surface: string;
  };
  /** Ranking ladder, lowest to highest. */
  ranks: RankLevel[];
  rules: {
    requiredDrivesForPromotion: number;
    /** Matches the dual-marshal review modeled by the `examinations` table. */
    requiredMarshalApprovals: number;
  };
};

export const CLUB_CONFIG: ClubConfig = {
  metadata: {
    name: "COMPASS",
    shortName: "COMPASS",
    tagline: "Community of Pinoy Adventure Sports Seekers",
    pillars: ["Safe Skill Development", "Mentorship", "Community"],
    logoUrl: null,
  },
  theme: {
    primary: "bg-forest text-off-white",
    primaryText: "text-forest",
    secondary: "bg-sand text-charcoal",
    secondaryText: "text-charcoal-light",
    accentBg: "bg-sand-light",
    surface: "bg-off-white",
  },
  ranks: [
    {
      level: 0,
      title: "Member",
      description:
        "Newly signed up and pending Marshal approval — can join an All Levels drive or a single Newbie orientation drive to get started.",
      colorVar: "--color-tier-0",
    },
    {
      level: 1,
      title: "Newbie",
      description:
        "New to the club and off-road driving — learning the basics under guidance.",
      colorVar: "--color-tier-1",
    },
    {
      level: 2,
      title: "Rookie",
      description:
        "Completed orientation and is building trail experience on official drives.",
      colorVar: "--color-tier-2",
    },
    {
      level: 3,
      title: "Intermediate",
      description:
        "Comfortable on moderate terrain and drives independently on club runs.",
      colorVar: "--color-tier-3",
    },
    {
      level: 4,
      title: "Advanced",
      description:
        "Skilled on challenging trails and mentors newer members.",
      colorVar: "--color-tier-4",
    },
    {
      level: 5,
      title: "Marshal",
      description:
        "Certified to lead official drives and review member promotions.",
      colorVar: "--color-tier-5",
    },
  ],
  rules: {
    requiredDrivesForPromotion: 5,
    requiredMarshalApprovals: 2,
  },
};

/**
 * COMPASS-specific rank curriculum: the must-skills, tools, challenges, and
 * milestones a member works through at each level. Unlike `CLUB_CONFIG`
 * above, this is real club content, not a white-label-swappable value —
 * a different club's curriculum would replace this object outright rather
 * than edit its fields.
 *
 * This is reference/source-of-truth data only, matching the club's official
 * progression document — nothing in the app currently enforces most of it
 * (e.g. must-skill ordering, exam unlock conditions, tools verification).
 * Each field is a candidate for real enforcement logic when that specific
 * piece gets built, not a promise that it's already wired up.
 */
export type RankCurriculum = {
  name: string;
  requiredDrives?: number;
  requiredSupervisedLeads?: number;
  requiredTripReports?: number;
  /** True when requiredTripReports must specifically come from Must-Skill
   * drives, not just any drive the member attended — the official doc only
   * draws this distinction starting at Rookie->Intermediate; Newbie->Rookie
   * counts trip reports from any drive. */
  tripReportsFromMustSkillDrives?: boolean;
  mustSkills?: string[];
  /** When set, this exact string (already present in mustSkills) is the
   * mandatory final must-skill drive for this rank — only bookable once
   * every other must-skill and the required drive count are complete. */
  gatedFinalMustSkill?: string;
  toolsRequired?: string[];
  challenges?: string[];
  milestones?: string[];
  isMax?: boolean;
};

/**
 * Cross-cutting rules that apply across every rank transition rather than
 * belonging to one specific rank's curriculum below. Reference data only,
 * same caveat as RankCurriculum — nothing enforces these yet.
 */
export const GLOBAL_PROGRESSION_RULES = [
  "Trip reports are always submitted against the actual drive, never a standalone skill.",
  "A single drive may address 0, 1, 2, or 3 Must Skills, depending on what the drive covers.",
  "A Must-Skill drive is only mandatory for a driver who wants to progress to the next rank — it's never required just to keep driving.",
  "Golden Ticket Rule: participating in a GPS Challenge grants 1 Golden Ticket, redeemable in lieu of exactly 1 Must-Skill drive.",
];

export const COMPASS_RANKS: Record<0 | 1 | 2 | 3 | 4 | 5, RankCurriculum> = {
  0: {
    name: "Member (MEM)",
    requiredDrives: 1,
    requiredTripReports: 1,
    milestones: [
      "Register for an All Levels drive or your first Newbie (NWB) drive",
      "Submit a trip report for that drive",
      "Marshal verification, if trip report approval is enabled in system settings",
      "Promotion to Newbie (NWB), with an optional celebratory announcement",
    ],
  },
  1: {
    name: "Newbie (NWB)",
    requiredDrives: 5,
    requiredTripReports: 5,
    mustSkills: [
      "Intro to Offroading",
      "Straight Crest",
      "Basic Vehicle Control",
      "Egg Basket Training",
      "Intro to ROK", // Mandatory last drive in NWB
    ],
    gatedFinalMustSkill: "Intro to ROK",
    toolsRequired: [
      "Two-way Radio",
      "Deflation/Inflation Pressure Gauge",
      "Air Compressor",
      "Mounted Flag",
      "Fire Extinguisher",
      "Floor Jack (2Ton+)",
      "Jack Baseboard",
      "Kinetic Recovery Rope",
      "Soft Shackles x2",
      "Shovel",
      "Good Condition Spare Tyre",
      "Tyre Lug Nut Wrench",
      "Front Recovery Points",
      "Rear Recovery Points",
      "First Aid Kit",
    ],
  },
  2: {
    name: "Rookie (ROK)",
    requiredDrives: 5,
    requiredTripReports: 5,
    tripReportsFromMustSkillDrives: true,
    mustSkills: [
      "Basic GPS Nav.",
      "Night Drive",
      "Traverse Drive",
      "Basic Recovery",
      "Pala Drive",
      "Intro to INT", // Mandatory transition drive, taken after R1 & R2
    ],
    gatedFinalMustSkill: "Intro to INT",
    toolsRequired: ["GPS", "Offroad Lights"],
    challenges: [
      "R1: Catch the Flag — buddy-system challenge, unlocked after all required drives/must-skills; mention your buddy's name in your challenge post",
      "R2: Maze — individual challenge, unlocked after all required drives/must-skills",
    ],
  },
  3: {
    name: "Intermediate (INT)",
    requiredDrives: 5,
    requiredTripReports: 5,
    tripReportsFromMustSkillDrives: true,
    mustSkills: [
      "Technical & Fast-pace Drives",
      "Adv. GPS Proficiency",
      "Sweep/Recovery/Support",
      "Solo – Night Drive",
      "Solo – Day Drive",
    ],
    challenges: [
      "I1: Point & Shoot — solo day drive focusing on compass bearing",
      "I2: Night Recon — solo night drive focusing on GPS navigation",
      "I3: King of the Hill — located in Liwa",
    ],
    milestones: [
      "3 Solo GPS Proficiency Drives — night & day, minimum 50km each; inform your Marshal beforehand, then provide photo/video and a recorded GPX track",
      "3 Intro Lead Drives",
    ],
  },
  4: {
    name: "Advanced (ADV)",
    requiredSupervisedLeads: 10,
    requiredTripReports: 10,
    tripReportsFromMustSkillDrives: true,
    mustSkills: [
      "Route Planning & Plotting",
      "Lead Must-Skill Drives (All Lvls)",
      "Convoy Management",
      "Accident Response/Recovery",
      "EXPLORATION (New Area/Route)",
      "Mock GPS Challenge (lead a team of INT/ADV drivers)",
    ],
    milestones: [
      "Marshalship Training — endorsement from Gen1 Marshals and training with active Marshals in leading Must-Skill drives at all levels",
      "Marshals Vote — Council/Marshal vote approval",
      "Marshalship NWB Drive — final marshalship drive assessment",
    ],
  },
  5: {
    // Permissions once reached (not progression requirements — this rank is
    // the ceiling): post/lead drives, approve new user signups, check/
    // verify/approve trip reports, and verify tools/exams. Already the
    // actual enforced behavior via is_marshal/is_admin checks throughout
    // the app, not something this reference object drives.
    name: "Marshal (MAR)",
    isMax: true,
  },
};

/** The 15-point mandatory gear check for Newbie -> Rookie promotion — the
 * same list as `COMPASS_RANKS[1].toolsRequired` above, just re-exported
 * under its own name for the Equipment Portal / Marshal Verification code
 * to depend on without reaching into the rank curriculum object directly. */
export const MANDATORY_EQUIPMENT: string[] = COMPASS_RANKS[1].toolsRequired ?? [];

/** "3 Solo GPS Proficiency Drives" (Intermediate -> Advanced) is a
 * repeatable requirement, not a single pass/fail — how many *passed*
 * SOLO_GPS_DRIVE exam_submissions rows are needed. Lives here rather than
 * in profile/exams/actions.ts because that file has "use server" and every
 * export from a Server Actions module must be an async function; a plain
 * constant export breaks its whole export contract (confirmed: Next's
 * build fails with "module has no exports at all" if you try). */
export const SOLO_GPS_DRIVES_REQUIRED = 3;
