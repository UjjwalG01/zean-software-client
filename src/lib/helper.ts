import { FISCAL_YEAR } from "./settings";

// function getYearlyUnique4Digit(): string {
//     const now = new Date();
//     const start = new Date(now.getFullYear(), 0, 1);
//     const diffMs = now.getTime() - start.getTime();
//     const hourOfYear = Math.floor(diffMs / (1000 * 60 * 60)) + 1;
//     return String(hourOfYear).padStart(4, "0");
// }

// export function generateNextBillNumber(
//     prefix: string = "CHG",
//     fiscalYear: string | number = FISCAL_YEAR
// ): string {
//     const cleanPrefix = prefix.replace(/-$/, "").toUpperCase();
//     const suffix = getYearlyUnique4Digit();

//     return `${cleanPrefix}-${fiscalYear}-${suffix}`;
// }



let lastMsOfYear = -1;
const yearStr = new Date().getFullYear().toString().slice(-2);

/** Generates a unique 7-character suffix based on the current time within the year. */
function get7CharUniqueSuffix(): string {
    const now = Date.now();
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).getTime();
    let msOfYear = now - startOfYear;

    // Guard against multiple calls in the exact same millisecond
    if (msOfYear <= lastMsOfYear) {
        msOfYear = lastMsOfYear + 1;
    }
    lastMsOfYear = msOfYear;

    // Convert milliseconds into a 7-character uppercase Base-36 string
    return msOfYear.toString(36).padStart(7, "0").toUpperCase();
}

/** Generates the next bill number with a unique suffix. */
export function generateNextBillNumber(
    prefix: string = "CHG",
): string {
    const cleanPrefix = prefix.replace(/-$/, "").toUpperCase();
    const suffix = get7CharUniqueSuffix();

    return `${cleanPrefix}-${suffix}/${yearStr}`;
}