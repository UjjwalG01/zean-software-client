/**
 * Global timezone helper. All app date formatting + day-bucketing should go
 * through these helpers so a single setting controls the entire UI.
 *
 * The active timezone is whatever is stored in companySettings.timezone, with
 * the browser's IANA timezone (`Intl.DateTimeFormat().resolvedOptions()`) as
 * the default suggestion.
 */

let _override: string | null = null;

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kathmandu";
  } catch {
    return "Asia/Kathmandu";
  }
}

/** Set the app-wide active timezone (call from a top-level effect after settings load). */
export function setAppTimezone(tz?: string | null) {
  _override = tz && tz.trim() ? tz.trim() : null;
}

export function getAppTimezone(): string {
  return _override || getBrowserTimezone();
}

/** List of all IANA timezones the runtime knows about (best-effort, with fallback). */
export function listTimezones(): string[] {
  // @ts-expect-error — added in modern engines
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      // @ts-expect-error
      return Intl.supportedValuesOf("timeZone");
    } catch {
      /* fall through */
    }
  }
  return [
    "UTC", "Asia/Kathmandu", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore",
    "Asia/Tokyo", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney",
  ];
}

/** Return YYYY-MM-DD for the given Date in the active timezone. */
export function toIsoDayInTz(date: Date | string, tz: string = getAppTimezone()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d); // en-CA → YYYY-MM-DD
}

/** Format a Date for display in the active timezone. */
export function formatInTz(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
  tz: string = getAppTimezone(),
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { timeZone: tz, ...options }).format(d);
}

/** Build a date-only ISO bound (start of day) for the configured TZ. */
export function startOfDayIsoInTz(day: string, tz: string = getAppTimezone()): string {
  // `day` is YYYY-MM-DD. Pretend the wall clock 00:00 in the configured TZ, return UTC ISO.
  return zonedStringToUtcIso(`${day}T00:00:00`, tz);
}

export function endOfDayIsoInTz(day: string, tz: string = getAppTimezone()): string {
  return zonedStringToUtcIso(`${day}T23:59:59.999`, tz);
}

/**
 * Convert a "wall clock" timestamp in `tz` (no offset suffix) into a UTC ISO string.
 * Uses an offset-probing trick because there is no built-in API.
 */
function zonedStringToUtcIso(wall: string, tz: string): string {
  const guess = new Date(wall + "Z"); // pretend it's UTC first
  const offsetMs = tzOffsetMs(guess, tz);
  return new Date(guess.getTime() - offsetMs).toISOString();
}

function tzOffsetMs(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return asUtc - date.getTime();
}
