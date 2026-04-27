import { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { Check, Icon, Trophy } from "#/components/icons.tsx";
import { PuzzleManifestEntry } from "#/game/types.ts";

type CalendarGridProps = {
  href: Signal<string>;
  selectedDate: Temporal.PlainDate;
  bestMoves: Record<string, number>;
  today: Temporal.PlainDate;
  entries: PuzzleManifestEntry[];
};

export function CalendarGrid({
  href,
  selectedDate,
  bestMoves,
  today,
  entries,
}: CalendarGridProps) {
  const daysInMonth = selectedDate.daysInMonth;
  const firstOfMonth = new Temporal.PlainDate(
    selectedDate.year,
    selectedDate.month,
    1,
  );

  return (
    <div className="grid grid-cols-7 text-center lg:gap-1">
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
                "flex flex-col items-center py-2 rounded-1",
                "border-1 border-surface-2 text-3 text-text-2 leading-none",
                "slashed cursor-not-allowed",
              )}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-round font-medium leading-none">
                {day}
              </span>
            </div>
          );
        }

        const isActive = selectedDate.day === day;
        const bestForDay = entry ? bestMoves[entry.slug] : undefined;
        const isSolved = bestForDay !== undefined;
        const isOptimal = isSolved && entry?.minMoves !== undefined &&
          bestForDay === entry.minMoves;

        return (
          <a
            key={day}
            href={buildDayHref(href.value, selectedDate, day)}
            aria-label={isSolved
              ? `${entry?.name}, solved in ${bestForDay} moves${
                isOptimal ? " (optimal)" : ""
              }`
              : `${entry?.name}, unsolved`}
            aria-current={isActive || undefined}
            autoFocus={isActive}
            className={clsx(
              "flex flex-col items-center justify-center py-2",
              "no-underline text-3 leading-none text-text-1 border-1 border-surface-2 transition-colors",
              "lg:rounded-1",
              "hover:bg-surface-2 hover:border-link",
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
            <Icon
              icon={isOptimal ? Trophy : Check}
              className={clsx(
                "text-2",
                isOptimal ? "text-ui-2" : isSolved ? "text-ui-1" : "invisible",
              )}
              aria-hidden="true"
            />
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
