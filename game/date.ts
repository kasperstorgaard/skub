const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Gets the day of the year (1-365/366) for a given date
 */
export function getDayOfYear(date: Date | Temporal.PlainDate): number {
  if (date instanceof Temporal.PlainDate) return date.dayOfYear;

  const firstDayOfYear = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - firstDayOfYear.getTime()) / ONE_DAY_MS);
}
