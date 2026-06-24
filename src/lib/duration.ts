/**
 * Human-readable label for a duration expressed in months.
 * Examples: 1 → "1 month", 3 → "3 months", 12 → "1 year",
 *           18 → "1 year 6 months", 180 → "15 years".
 */
export function formatMonths(months: number): string {
  const m = Math.max(0, Math.round(Number(months) || 0));
  if (m === 0) return "0 months";
  if (m < 12) return `${m} month${m === 1 ? "" : "s"}`;
  const years = Math.floor(m / 12);
  const rem = m % 12;
  const yPart = `${years} year${years === 1 ? "" : "s"}`;
  if (rem === 0) return yPart;
  return `${yPart} ${rem} month${rem === 1 ? "" : "s"}`;
}
