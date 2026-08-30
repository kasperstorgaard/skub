import type { Puzzle } from "#/game/types.ts";

/**
 * The day slot 1 falls on. Hardcoded because the schedule is a fact about this
 * game, not about the calendar.
 */
const FIRST_PUZZLE_DATE = Temporal.PlainDate.from("2026-01-01");

const toPlainDate = (date: Date | Temporal.PlainDate): Temporal.PlainDate =>
  date instanceof Temporal.PlainDate ? date : Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });

/**
 * The schedule slot a date falls on — days since {@link FIRST_PUZZLE_DATE},
 * counting from 1. Counts on past 366 rather than resetting, so a new year
 * doesn't unrelease the archive.
 */
export function getPuzzleNumber(
  date: Date | Temporal.PlainDate = new Date(),
): number {
  return FIRST_PUZZLE_DATE.until(toPlainDate(date), { largestUnit: "day" })
    .days + 1;
}

/**
 * The highest puzzle number released as of today — everything numbered at or
 * below it is playable, everything above is still queued.
 */
export function getTodaysPuzzleNumber(): number {
  return getPuzzleNumber();
}

/**
 * True when the puzzle's `number` is today's slot. Returns false for entries
 * without a `number` (tutorial / onboarding).
 */
export function isTodaysPuzzle(puzzle: Pick<Puzzle, "number">): boolean {
  return puzzle.number !== undefined &&
    puzzle.number === getTodaysPuzzleNumber();
}
