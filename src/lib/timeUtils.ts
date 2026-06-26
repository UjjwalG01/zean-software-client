// src/lib/timeUtils.ts
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