import { clsx } from "clsx/lite";
import { page } from "fresh";

import { ArchiveMinimap } from "#/components/archive-minimap.tsx";
import {
  ArchiveDays,
  ArchiveSentinel,
  getMonthLabel,
} from "#/components/archive-row.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";
import { getPuzzleDate, getPuzzleNumber, getWeekRange } from "#/game/date.ts";
import { getArchiveBounds, listArchiveDays } from "#/game/loader.ts";
import { getArchiveDate } from "#/game/url.ts";
import { ArchiveScroller } from "#/islands/archive-scroller.tsx";

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

  return (
    <>
      <Main
        className={clsx(
          "max-lg:row-span-full items-stretch place-content-stretch",
          "lg:max-w-3xl!",
        )}
      >
        <Header back={{ href: "/" }} />

        <h1 className="text-brand text-6 leading-flat">Puzzles</h1>

        {/* Full bleed: the row runs past the content column to the edges */}
        <section
          aria-label="Puzzles by day"
          className={clsx(
            "@container grid gap-fl-2 w-dvw ml-[calc(50%_-_50dvw)]",
            "[timeline-scope:--archive-row]",
            // Home's card size: two to the content column, capped at its width
            "[--cards:2] [--gap:var(--size-fluid-4)] [--pad:var(--size-fluid-3)]",
            "[--col:min((100cqw_-_2_*_var(--pad)_-_var(--gap))_/_2,(32rem_-_var(--gap))_/_2)]",
            "lg:w-[calc(100dvw_-_16rem)] lg:ml-[calc(50%_-_(100dvw_-_16rem)_/_2)]",
            "lg:[--cards:4] lg:[--pad:max(var(--size-fluid-3),calc(50cqw_-_24rem))]",
          )}
        >
          <div className="grid gap-1 px-(--pad)">
            <ArchiveScroller
              bounds={bounds}
              range={range}
              current={current}
              month={getMonthLabel(getPuzzleDate(current))}
            />
            <ArchiveMinimap bounds={bounds} current={current} />
          </div>

          <ol
            id="archive-row"
            className={clsx(
              "relative grid grid-flow-col auto-cols-(--col) gap-(--gap) m-0 py-2 px-(--pad)",
              "overflow-x-auto overscroll-x-contain snap-x snap-proximity scroll-px-(--pad)",
              "[scroll-timeline:--archive-row_x]",
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
        </section>
      </Main>

      <Panel />
    </>
  );
});

/** The week a slot falls in, landing on that day; none past the bounds. */
function getWeekHref(number: number, bounds: { from: number; to: number }) {
  if (number < bounds.from || number > bounds.to) return undefined;
  const date = getPuzzleDate(number).toString();
  return `?date=${date}#${date}`;
}
