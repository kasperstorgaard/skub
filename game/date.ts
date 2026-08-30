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
 * counting from 1.
 *
 * Counts on across new years rather than resetting: numbers are a sequence
 * (`update-puzzles` hands out `max + 1`) and will pass 366, so measuring them
 * against day-of-year would unrelease the whole archive every Jan 1. Within
 * 2026 the two agree exactly, since slot 1 is Jan 1.
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
 *
 * Named for what callers mean rather than how it's derived: they ask which
 * puzzles are due, not what the date is. The corpus fills slots sparsely, so
 * plenty have no puzzle, and `createdAt` is when a file was written rather than
 * the day its slot comes round — the two don't line up and aren't meant to.
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
