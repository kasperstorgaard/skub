import { clsx } from "clsx/lite";
import { page } from "fresh";

import {
  ArchiveDays,
  ArchiveSentinel,
  getMonthName,
} from "#/components/archive-row.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";
import {
  getPuzzleDate,
  getPuzzleNumber,
  getWeekRange,
  type SlotRange,
} from "#/game/date.ts";
import { getArchiveBounds, listArchiveDays } from "#/game/loader.ts";
import { getArchiveDate } from "#/game/url.ts";
import {
  ArchiveHeading,
  type ArchiveMonth,
} from "#/islands/archive-heading.tsx";

export const handler = define.handlers({
  async GET(ctx) {
    const bounds = await getArchiveBounds();
    const date = getArchiveDate(ctx.url) ?? Temporal.Now.plainDateISO();
    const current = Math.min(
      bounds.to,
      Math.max(bounds.from, getPuzzleNumber(date)),
    );
    const range = getWeekRange(getPuzzleDate(current), bounds);
    const days = await listArchiveDays(range);

    return page({ bounds, range, current, days });
  },
});

export default define.page<typeof handler>(function PuzzlesPage(props) {
  const { bounds, range, current, days } = props.data;
  const date = getPuzzleDate(current);

  return (
    <>
      <Main
        className={clsx(
          "max-lg:row-span-full items-stretch place-content-stretch",
          "lg:max-w-5xl!",
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
            week: date.weekOfYear ?? 0,
          }}
          months={getMonths(bounds)}
        />

        <ol
          id="archive-row"
          aria-label="Puzzles by day"
          className={clsx(
            // Mobile: full bleed, 2.2 cards past the inset so it always
            // overflows, never larger than home's cards
            "relative grid m-0 py-2",
            "[--gap:var(--size-fluid-4)] [--pad:var(--size-fluid-3)]",
            "[--col:min((100dvw_-_var(--pad)_-_2_*_var(--gap))_/_2.2,(32rem_-_var(--gap))_/_2)]",
            "max-lg:w-dvw max-lg:ml-[calc(50%_-_50dvw)] max-lg:px-(--pad)",
            "max-lg:grid-flow-col max-lg:auto-cols-(--col) max-lg:gap-(--gap)",
            "max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:snap-x max-lg:snap-proximity max-lg:scroll-px-(--pad)",
            // Desktop: the week in one row, an arrow column either side
            "lg:grid-cols-[auto_repeat(7,minmax(0,1fr))_auto] lg:gap-fl-2",
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
