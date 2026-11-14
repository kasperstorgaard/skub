import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { page } from "fresh";

import {
  ArchiveDays,
  ArchiveSentinel,
  getMonthName,
} from "#/components/archive-row.tsx";
import { DesktopCalendar } from "#/components/desktop-calendar.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleCard } from "#/components/puzzle-card.tsx";
import { define } from "#/core.ts";
import {
  getPuzzleDate,
  getPuzzleNumber,
  getWeekRange,
  type SlotRange,
} from "#/game/date.ts";
import {
  getArchiveBounds,
  getAvailableEntries,
  listArchiveDays,
} from "#/game/loader.ts";
import { getArchiveDate } from "#/game/url.ts";
import {
  ArchiveHeading,
  type ArchiveMonth,
} from "#/islands/archive-heading.tsx";

export const handler = define.handlers({
  async GET(ctx) {
    const bounds = await getArchiveBounds();
    const today = Temporal.Now.plainDateISO();
    const date = getArchiveDate(ctx.url) ?? today;
    const current = Math.min(
      bounds.to,
      Math.max(bounds.from, getPuzzleNumber(date)),
    );
    const range = getWeekRange(getPuzzleDate(current), bounds);
    const days = await listArchiveDays(range);
    const entries = await getAvailableEntries();

    return page({ bounds, range, current, days, today, entries });
  },
});

export default define.page<typeof handler>(function PuzzlesPage(props) {
  const { bounds, range, current, days, today, entries } = props.data;
  const date = getPuzzleDate(current);
  const puzzle = days.find((day) => day.number === current)?.puzzle;
  const href = useSignal(props.url.href);

  return (
    <>
      <Main
        className={clsx(
          "max-lg:row-span-full items-stretch place-content-stretch",
          "lg:max-w-3xl!",
        )}
      >
        <Header back={{ href: "/" }} />

        <ArchiveHeading
          bounds={bounds}
          range={range}
          current={current}
          day={{
            date: date.toString(),
            month: getMonthName(date),
            year: date.year,
          }}
          months={getMonths(bounds)}
        />

        <ol
          id="archive-row"
          aria-label="Puzzles by day"
          className={clsx(
            // Full bleed, a card centred with 0.2 of each neighbour showing,
            // capped for wide phones and tablets
            "relative grid grid-flow-col auto-cols-(--col) gap-(--gap) w-dvw ml-[calc(50%_-_50dvw)] m-0 py-2 px-(--pad)",
            "overflow-x-auto overscroll-x-contain snap-x snap-proximity no-scrollbar",
            "[--gap:var(--size-fluid-4)]",
            "[--col:min((100dvw_-_2_*_var(--gap))_/_1.4,24rem)]",
            // Lets the first and last cards centre too
            "[--pad:calc((100dvw_-_var(--col))_/_2)]",
            "lg:hidden",
          )}
        >
          <ArchiveSentinel
            side="before"
            span={range.from - bounds.from}
            href={getWeekHref(range.from - 1, bounds)}
          />
          <ArchiveDays days={days} score={props.state.score} />
          <ArchiveSentinel
            side="after"
            span={bounds.to - range.to}
            href={getWeekHref(range.to + 1, bounds)}
          />
        </ol>

        <section
          f-client-nav
          aria-label="Calendar"
          className="grid gap-fl-3 content-start grid-cols-2 max-lg:hidden"
        >
          <DesktopCalendar
            href={href}
            bestMoves={props.state.progress}
            score={props.state.score}
            selectedDate={date}
            entries={entries}
            today={today}
          />

          <div className="self-start">
            {puzzle
              ? (
                <PuzzleCard
                  puzzle={puzzle}
                  score={props.state.score[puzzle.slug]}
                  showPlay
                  size="lg"
                />
              )
              : (
                <div className="border-1 border-surface-2 rounded-2 p-fl-2 text-text-2 text-3 grid place-content-center min-h-40 text-center">
                  No puzzle on this day.
                </div>
              )}
          </div>
        </section>
      </Main>

      <Panel />
    </>
  );
});

/** The week a slot falls in, landing on that day; none past the bounds. */
function getWeekHref(number: number, bounds: SlotRange) {
  if (number < bounds.from || number > bounds.to) return undefined;
  const date = getPuzzleDate(number).toString();
  return `?date=${date}#${date}`;
}

/** Each month the archive spans, from its first slot within the bounds. */
function getMonths(bounds: SlotRange): ArchiveMonth[] {
  const first = getPuzzleDate(bounds.from);
  const last = getPuzzleDate(bounds.to);
  const months = [];

  for (
    let month = first.with({ day: 1 });
    Temporal.PlainDate.compare(month, last) <= 0;
    month = month.add({ months: 1 })
  ) {
    const date = Temporal.PlainDate.compare(month, first) < 0 ? first : month;
    months.push({
      key: date.toString().slice(0, 7),
      name: getMonthName(date),
      number: getPuzzleNumber(date),
      date: date.toString(),
    });
  }

  return months;
}
