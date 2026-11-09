import { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { Stars } from "#/components/stars.tsx";
import type { ScoreProgress } from "#/game/score.ts";
import { PuzzleManifestEntry } from "#/game/types.ts";

type DesktopCalendarProps = {
  href: Signal<string>;
  selectedDate: Temporal.PlainDate;
  bestMoves: Record<string, number>;
  score: ScoreProgress;
  today: Temporal.PlainDate;
  entries: PuzzleManifestEntry[];
};

export function DesktopCalendar({
  href,
  selectedDate,
  bestMoves,
  score,
  today,
  entries,
}: DesktopCalendarProps) {
  const daysInMonth = selectedDate.daysInMonth;
  const firstOfMonth = new Temporal.PlainDate(
    selectedDate.year,
    selectedDate.month,
    1,
  );

  return (
    <div className="grid grid-cols-7 auto-rows-[3.75rem] text-center lg:gap-1">
      {Array.from({ length: firstOfMonth.dayOfWeek }).map((_, i) => (
        <div key={`empty-${i}`} />
      ))}

      {Array.from({ length: daysInMonth }).map((_, idx) => {
        const day = idx + 1;
        const dayOfYear = firstOfMonth.dayOfYear + idx;

        const entry = entries.find((item) => item.number === dayOfYear);

        if (!entry) {
          return (
            <div
              key={dayOfYear}
              className={clsx(
                "flex flex-col items-center justify-center rounded-1",
                "border-1 border-surface-2 text-3 text-text-2 leading-none",
                "slashed cursor-not-allowed",
              )}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-round font-medium leading-none">
                {day}
              </span>
              {/* The stars' row, so numbers line up with solved days */}
              <span className="h-[1em] text-2" aria-hidden="true" />
            </div>
          );
        }

        const isActive = selectedDate.day === day;
        const bestForDay = entry ? bestMoves[entry.slug] : undefined;
        // Kinds come stored per puzzle, not worked out from the moves.
        const kinds = score[entry.slug] ?? [];
        // A Flash solve counts as solved, but sets no best.
        const isSolved = bestForDay !== undefined || kinds.length > 0;
        const isOptimal = kinds.includes("perfect");

        return (
          <a
            key={day}
            href={buildDayHref(href.value, selectedDate, day)}
            aria-label={bestForDay !== undefined
              ? `${entry?.name}, solved in ${bestForDay} moves${
                isOptimal ? " (optimal)" : ""
              }`
              : isSolved
              ? `${entry?.name}, solved from the Flash start`
              : `${entry?.name}, unsolved`}
            aria-current={isActive || undefined}
            autoFocus={isActive}
            className={clsx(
              "flex flex-col items-center justify-center",
              "no-underline text-3 leading-none text-text-1 border-1 border-surface-2 transition-colors",
              "lg:rounded-1",
              // The stars cut their gaps in the cell's own background.
              "hover:bg-surface-2 hover:border-link hover:[--star-knockout:var(--color-surface-2)]",
              isActive &&
                "outline-link outline-2 -outline-offset-2",
            )}
          >
            <span
              className={clsx(
                "flex items-center justify-center w-7 h-7 rounded-round font-medium leading-none",
                selectedDate.month === today.month && today.day === day &&
                  "text-link",
              )}
            >
              {day}
            </span>
            {/* A row of stars' height either way, so the grid doesn't jump */}
            <span className="flex h-[1em] text-2" aria-hidden="true">
              <Stars kinds={kinds} />
            </span>
          </a>
        );
      })}
    </div>
  );
}

function buildDayHref(href: string, date: Temporal.PlainDate, day: number) {
  const url = new URL(href);
  const newDate = new Temporal.PlainDate(date.year, date.month, day);

  url.searchParams.set("date", newDate.toString());

  return url.href;
}
