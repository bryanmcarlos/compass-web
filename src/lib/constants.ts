/**
 * Single source of truth for club branding, theme, ranks, and rules.
 * A white-labeled deployment for a different club only needs to edit this
 * file (and its matching CSS custom properties in `app/globals.css`) — no
 * page or component should hardcode club identity, copy, or rank names.
 */

export type RankLevel = {
  /** 1 = lowest rank, 5 = highest. */
  level: 1 | 2 | 3 | 4 | 5;
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
 */
export type RankCurriculum = {
  name: string;
  requiredDrives?: number;
  requiredSupervisedLeads?: number;
  requiredTripReports?: number;
  mustSkills?: string[];
  toolsRequired?: string[];
  challenges?: string[];
  milestones?: string[];
  isMax?: boolean;
};

export const COMPASS_RANKS: Record<1 | 2 | 3 | 4 | 5, RankCurriculum> = {
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
    toolsRequired: ["Deflator", "Pressure Gauge", "Flag", "Radio"],
  },
  2: {
    name: "Rookie (ROK)",
    requiredDrives: 5,
    requiredTripReports: 5,
    mustSkills: [
      "Basic GPS Nav.",
      "Night Drive",
      "Traverse Drive",
      "Basic Recovery",
      "Pala Drive",
    ],
    toolsRequired: ["Offroad Lights", "GPS App (GAIA)"],
  },
  3: {
    name: "Intermediate (INT)",
    requiredDrives: 5,
    requiredTripReports: 5,
    mustSkills: [
      "Technical & Fast-pace Drives",
      "Adv. GPS Proficiency",
      "Sweep/Recovery/Support",
      "Solo – Night Drive",
      "Solo – Day Drive",
    ],
    challenges: ["I1: Point & Shoot", "I2: Night Recon", "I3: King of the Hill (Liwa)"],
  },
  4: {
    name: "Advanced (ADV)",
    requiredSupervisedLeads: 10,
    requiredTripReports: 10,
    mustSkills: [
      "Route Planning & Plotting",
      "Lead Must-Skill Drives (All Lvls)",
      "Convoy Management",
      "Accident Response/Recovery",
      "EXPLORATION (New Area/Route)",
      "Mock GPS Challenge",
    ],
    milestones: ["Marshalship Training", "Marshals Vote", "Marshalship NWB Drive"],
  },
  5: {
    name: "Marshal (MAR)",
    isMax: true,
  },
};
