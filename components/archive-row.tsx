import { clsx } from "clsx/lite";

import { PuzzleCard, PuzzleCardCaption } from "#/components/puzzle-card.tsx";
import { getPuzzleDate, type SlotRange } from "#/game/date.ts";
import type { ArchiveDay } from "#/game/loader.ts";
import type { ScoreProgress } from "#/game/score.ts";

type ArchiveDaysProps = {
  days: ArchiveDay[];
  score: ScoreProgress;
  /** The day to land on: centred without JS where the browser can. */
  current: number;
  /** Days whose thumbnails the server draws; the rest wait for the script. */
  drawn: SlotRange;
};

/**
 * One grid item per day: its puzzle, or a muted stand-in. Every day is in the
 * row from the first paint, so its scroll width never changes; only the
 * thumbnails outside `drawn` are filled in later, into boxes of fixed size.
 */
export function ArchiveDays({ days, score, current, drawn }: ArchiveDaysProps) {
  return (
    <>
      {days.map(({ number, puzzle }) => {
        const date = getPuzzleDate(number);

        return (
          <li
            key={number}
            id={date.toString()}
            data-number={number}
            data-month={getMonthName(date)}
            data-year={date.year}
            className={clsx(
              "snap-center min-w-0 list-none pl-0",
              // Purple frames only on the centred card; all of them without JS
              "[--frame:var(--color-link)] js:[--frame:var(--color-surface-3)]",
              "data-centred:[--frame:var(--color-link)]",
              "[&_.puzzle-card-thumb]:border-(--frame)",
              number === current && "[scroll-initial-target:nearest]",
            )}
          >
            {
              /* Off-screen cards skip rendering. Their height is kept under a
                real card's, so the drawn cards in view set the row's height */
            }
            <div className="[content-visibility:auto] [contain-intrinsic-size:auto_var(--col)_auto_var(--col)]">
              {puzzle
                ? (
                  <PuzzleCard
                    puzzle={puzzle}
                    score={score[puzzle.slug]}
                    size="lg"
                    deferThumbnail={number < drawn.from || number > drawn.to}
                  />
                )
                : (
                  <div className="flex flex-col gap-2 text-text-3">
                    <div className="aspect-square border-2 border-surface-3 rounded-1" />
                    <PuzzleCardCaption size="lg">
                      <span className="text-5 font-3 leading-flat">
                        No puzzle
                      </span>
                    </PuzzleCardCaption>
                  </div>
                )}
            </div>
          </li>
        );
      })}
    </>
  );
}

/** "November": the heading's month while a day is centred. */
export function getMonthName(date: Temporal.PlainDate) {
  return date.toLocaleString("en", { month: "long" });
}
