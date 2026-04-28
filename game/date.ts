import type { Puzzle } from "#/game/types.ts";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Gets the day of the year (1-365/366) for a given date
 */
export function getDayOfYear(date: Date | Temporal.PlainDate): number {
  if (date instanceof Temporal.PlainDate) return date.dayOfYear;

  const firstDayOfYear = new Date(date.getFullYear(), 0, 0);
  return Math.floor((date.getTime() - firstDayOfYear.getTime()) / ONE_DAY_MS);
}

/**
 * True when the puzzle's `number` matches today's day-of-year. Returns false
 * for entries without a `number` (tutorial / onboarding).
 */
export function isTodaysPuzzle(puzzle: Pick<Puzzle, "number">): boolean {
  return puzzle.number !== undefined &&
    puzzle.number === getDayOfYear(new Date());
}
