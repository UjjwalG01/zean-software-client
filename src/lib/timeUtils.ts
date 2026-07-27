import { parseISO, differenceInDays, differenceInMonths, isValid } from "date-fns";

// src/lib/timeUtils.ts
//
// Single source of truth for all "current date/time" reads across the app.
// Components MUST NOT call `new Date()` directly to read the current moment —
// they consume these helpers so the entire UI stays anchored to the same
// system timezone regardless of browser locale.
export const SYSTEM_TZ = "Asia/Kathmandu";

export const getSystemTodayStr = (): string => {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: SYSTEM_TZ,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
};

export const getSystemTimeStr = (): string => {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: SYSTEM_TZ,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date());
};

/**
 * Returns a complete timestamp (YYYY-MM-DDTHH:mm:ss) strictly locked
 * to Kathmandu time, bypassing browser local clock conversions.
 * Use for DB writes, audit logs, and any persisted event time.
 */
export const getSystemTimestamp = (): string => {
    const datePart = getSystemTodayStr();
    const timePart = new Intl.DateTimeFormat("en-GB", {
        timeZone: SYSTEM_TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date());

    return `${datePart}T${timePart}`;
};

/**
 * Returns a `Date` object representing "now" as seen in the system timezone.
 * Use only when an API requires a `Date` (e.g. date-fns `format`, calendar
 * comparisons). Internally derived from `getSystemTimestamp()` so callers
 * never reach for `new Date()` themselves.
 */
export const getSystemNowDate = (): Date => {
    return new Date(getSystemTimestamp());
};

/** Current system month in "YYYY-MM" format. */
export const getSystemMonthStr = (): string => getSystemTodayStr().slice(0, 7);



export function formatTimePeriod(joinDate?: string | null, expiryDate?: string | null): string {
    if (!joinDate || !expiryDate) return "N/A";

    // Safely parse string dates like "2027-01-20"
    const start = parseISO(joinDate);
    const end = parseISO(expiryDate);

    if (!isValid(start) || !isValid(end)) return "N/A";

    const totalDays = differenceInDays(end, start);
    if (totalDays <= 0) return "Expired";

    const months = differenceInMonths(end, start);

    // 1 year or more -> format as years (e.g. "1 yr", "1.5 yrs", "2 yrs")
    if (months >= 12) {
        const years = Number((months / 12).toFixed(1));
        const formattedYears = Number.isInteger(years) ? years : years.toFixed(1);
        return `${formattedYears} ${formattedYears === 1 ? "yr" : "yrs"}`;
    }

    // Under a year -> format as months (e.g. "6 mos")
    if (months > 0) {
        return `${months} ${months === 1 ? "mo" : "mos"}`;
    }

    // Under a month -> format as days (e.g. "15 days")
    return `${totalDays} ${totalDays === 1 ? "day" : "days"}`;
}