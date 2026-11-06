import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { CalendarGrid } from "#/components/calendar-grid.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { MonthStrip } from "#/components/month-strip.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleCard } from "#/components/puzzle-card.tsx";
import { define } from "#/core.ts";
import { getAvailableEntries, getPuzzleByDate } from "#/game/loader.ts";
import { Puzzle, PuzzleManifestEntry } from "#/game/types.ts";
import { getArchiveDate } from "#/game/url.ts";
import { isDev } from "#/lib/env.ts";

type PageData = {
  today: Temporal.PlainDate;
  selectedDate: Temporal.PlainDate;
  selectedPuzzle: Puzzle;
  bestMoves: Record<string, number>;
  totalPuzzles: number;
  entries: PuzzleManifestEntry[];
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const url = ctx.url;
    const now = new Date(Date.now());

    const today = new Temporal.PlainDate(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
    );

    const selectedDate = getArchiveDate(url) ?? today;

    const entries = await getAvailableEntries();
    const bestMoves = ctx.state.progress;

    const totalPuzzles = entries.length;
    const selectedPuzzle = await getPuzzleByDate(selectedDate);

    if (!selectedPuzzle) {
      throw new HttpError(500, "Unable to get puzzle for selected date");
    }

    return page({
      today,
      selectedDate,
      selectedPuzzle,
      bestMoves,
      totalPuzzles,
      entries,
    });
  },
});

export default define.page<typeof handler>(function PuzzlesPage(props) {
  const {
    today,
    selectedDate,
    selectedPuzzle,
    bestMoves,
    totalPuzzles,
    entries,
  } = props.data;

  const href = useSignal(props.url.href);

  const dateLabel = new Date(
    selectedDate.year,
    selectedDate.month - 1,
    selectedDate.day,
  ).toLocaleDateString(
    undefined,
    { weekday: "long", day: "numeric", month: "long" },
  );

  return (
    <>
      <Main
        className={clsx(
          "max-lg:row-span-full items-stretch place-content-stretch",
          "lg:max-w-3xl!",
        )}
      >
        <Header back={{ href: "/" }} />

        <div className="flex flex-col gap-0">
          <span className="text-3 text-text-2">{selectedDate.year}</span>
          <h1 className="text-brand text-6 leading-flat">Puzzles</h1>
        </div>

        <section
          f-client-nav
          className="grid gap-fl-3 content-start lg:grid-cols-2"
        >
          <div className="grid grid-cols-subgrid place-content-start items-start gap-fl-2">
            <MonthStrip
              href={href}
              selectedDate={selectedDate}
              today={today}
              showFuture={isDev}
            />

            <CalendarGrid
              href={href}
              bestMoves={bestMoves}
              selectedDate={selectedDate}
              entries={entries}
              today={today}
            />
          </div>

          <div className="lg:self-start">
            {selectedPuzzle
              ? (
                <PuzzleCard
                  puzzle={selectedPuzzle}
                  bestMoves={bestMoves[selectedPuzzle.slug]}
                  tagline={dateLabel}
                  showPlay
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

      <Panel>
        <div
          className={clsx(
            "col-[2/3] flex flex-col gap-fl-2 items-start",
            "lg:col-auto lg:row-start-3",
          )}
        >
          <div className="flex flex-col gap-0">
            <span className="text-6 text-text-1 leading-flat font-medium tracking-wide">
              {totalPuzzles}
            </span>
            <span className="text-3 text-text-2">Puzzles</span>
          </div>
        </div>
      </Panel>
    </>
  );
});
