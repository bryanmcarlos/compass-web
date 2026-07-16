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
