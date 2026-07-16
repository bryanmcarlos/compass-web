import type { ComponentType } from "react";
import {
  Leaf,
  Wind,
  Mountain,
  Flame,
  Skull,
  CalendarClock,
  CalendarCheck,
  CalendarX,
} from "lucide-react";

export type DriveDifficulty =
  | "Easy"
  | "Moderate"
  | "Challenging"
  | "Hard"
  | "Extreme";
export type DriveStatus = "Scheduled" | "Completed" | "Cancelled";

const DIFFICULTY_STYLES: Record<
  DriveDifficulty,
  { icon: ComponentType<{ className?: string }>; fg: string; bg: string }
> = {
  Easy: {
    icon: Leaf,
    fg: "var(--color-diff-easy)",
    bg: "var(--color-diff-easy-bg)",
  },
  Moderate: {
    icon: Wind,
    fg: "var(--color-diff-moderate)",
    bg: "var(--color-diff-moderate-bg)",
  },
  Challenging: {
    icon: Mountain,
    fg: "var(--color-diff-challenging)",
    bg: "var(--color-diff-challenging-bg)",
  },
  Hard: {
    icon: Flame,
    fg: "var(--color-error)",
    bg: "var(--color-error-bg)",
  },
  Extreme: {
    icon: Skull,
    fg: "var(--color-diff-extreme)",
    bg: "var(--color-diff-extreme-bg)",
  },
};

const STATUS_STYLES: Record<
  DriveStatus,
  { icon: ComponentType<{ className?: string }>; fg: string }
> = {
  Scheduled: { icon: CalendarClock, fg: "var(--color-diff-moderate)" },
  Completed: { icon: CalendarCheck, fg: "var(--color-forest)" },
  Cancelled: { icon: CalendarX, fg: "var(--color-error)" },
};

export function DifficultyBadge({
  difficulty,
  className = "text-xs px-2.5 py-1 gap-1.5",
  iconClassName = "h-3.5 w-3.5",
}: {
  difficulty: DriveDifficulty;
  className?: string;
  iconClassName?: string;
}) {
  const { icon: Icon, fg, bg } = DIFFICULTY_STYLES[difficulty];
  return (
    <span
      style={{ color: fg, backgroundColor: bg }}
      className={`inline-flex shrink-0 items-center rounded-full font-semibold ${className}`}
    >
      <Icon className={iconClassName} />
      {difficulty}
    </span>
  );
}

export function StatusIndicator({
  status,
  className = "text-sm gap-1.5",
  iconClassName = "h-4 w-4",
}: {
  status: DriveStatus;
  className?: string;
  iconClassName?: string;
}) {
  const { icon: Icon, fg } = STATUS_STYLES[status];
  return (
    <span
      style={{ color: fg }}
      className={`inline-flex items-center font-medium ${className}`}
    >
      <Icon className={iconClassName} />
      {status}
    </span>
  );
}
