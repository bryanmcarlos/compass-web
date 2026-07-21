/** The one canonical rendering of a drive's driver-convoy count, used by the
 * detail page hero and every /drives card. Counts role="Driver"
 * registrations only — matches the existing "Drivers (X/Y)" roster header;
 * Lead/Support registrants are never counted toward X or Y. */
export function formatConvoyStatus(registeredDrivers: number, maxDrivers: number): string {
  return `👥 ${registeredDrivers} / ${maxDrivers} Drivers Registered`;
}

/** "3 hours ago" / "in 2 days" style formatting for an ISO timestamp —
 * shared by TripReportCard and CommentThread rather than duplicated. */
export function formatRelativeTime(iso: string) {
  const diffMinutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 24 * 365],
    ["month", 60 * 24 * 30],
    ["week", 60 * 24 * 7],
    ["day", 60 * 24],
    ["hour", 60],
    ["minute", 1],
  ];

  for (const [unit, minutesInUnit] of divisions) {
    if (unit === "minute" || Math.abs(diffMinutes) >= minutesInUnit) {
      return rtf.format(Math.round(diffMinutes / minutesInUnit), unit);
    }
  }
  return rtf.format(diffMinutes, "minute");
}

/** Formats a Postgres `date` string (e.g. "2026-01-24") without shifting a day for the local timezone. */
export function formatDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a Postgres `time` string (e.g. "05:00:00") as "5:00 AM".
 * Returns `null` instead of throwing or showing "Invalid Date" for null,
 * empty, or malformed/partial input — callers can use that to skip
 * rendering the row entirely rather than showing garbage.
 */
export function formatTime(timeStr: string | null | undefined): string | null {
  if (!timeStr) return null;
  try {
    const [hoursStr, minutesStr] = timeStr.split(":");
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (
      !Number.isInteger(hours) ||
      !Number.isInteger(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}
