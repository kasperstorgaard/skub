import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { CalendarGrid } from "#/components/calendar-grid.tsx";
import { Header } from "#/components/header.tsx";
import { Icon, Pencil } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { MonthStrip } from "#/components/month-strip.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleCard } from "#/components/puzzle-card.tsx";
import { define } from "#/core.ts";
import { getBestMoves, listUserSolutions } from "#/db/solutions.ts";
import { getAvailableEntries, getPuzzleByDate } from "#/game/loader.ts";
import { Difficulty, Puzzle, PuzzleManifestEntry } from "#/game/types.ts";
import { getArchiveDate } from "#/game/url.ts";

type PageData = {
  today: Temporal.PlainDate;
  selectedDate: Temporal.PlainDate;
  selectedPuzzle: Puzzle;
  bestMoves: Record<string, number>;
  difficultyBreakdown: Record<Difficulty, number>;
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

    const [entries, userSolutions] = await Promise.all([
      getAvailableEntries(),
      listUserSolutions(ctx.state.userId, { limit: "max" }),
    ]);

    const bestMoves = getBestMoves(userSolutions);

    const difficultyBreakdown: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    for (const entry of entries) {
      difficultyBreakdown[entry.difficulty]++;
    }

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
      difficultyBreakdown,
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
    difficultyBreakdown,
    totalPuzzles,
    entries,
  } = props.data;

  const url = new URL(props.req.url);
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
        <Header url={url} back={{ href: "/" }} share />

        <div className="flex flex-col gap-0">
          <h1 className="text-brand text-6 leading-flat">Archives</h1>
          <span className="text-3 text-text-2">{selectedDate.year}</span>
        </div>

        <section
          f-client-nav
          className="grid gap-fl-3 content-start lg:grid-cols-2"
        >
          <div className="grid grid-cols-subgrid place-content-start items-start gap-fl-2">
            <MonthStrip href={href} selectedDate={selectedDate} today={today} />

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

      <Panel className="max-lg:gap-y-fl-2">
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

          <div className="flex lg:flex-col gap-fl-2">
            <div className="flex flex-col gap-0">
              <span className="text-4 text-text-1 leading-flat font-medium tracking-wide">
                {difficultyBreakdown.hard}
              </span>
              <span className="text-3 text-text-2">Hard</span>
            </div>

            <div className="flex flex-col gap-0">
              <span className="text-4 text-text-1 leading-flat font-medium tracking-wide">
                {difficultyBreakdown.medium}
              </span>
              <span className="text-3 text-text-2">Medium</span>
            </div>

            <div className="flex flex-col gap-0">
              <span className="text-4 text-text-1 leading-flat font-medium tracking-wide">
                {difficultyBreakdown.easy}
              </span>
              <span className="text-3 text-text-2">Easy</span>
            </div>
          </div>
        </div>

        <div
          className={clsx(
            "col-[2/3] flex flex-col items-start text-2 text-text-2 mt-auto gap-fl-1",
            "lg:col-auto lg:row-start-3",
          )}
        >
          <span className="text-text-2 text-2">Feeling creative?</span>
          <a
            href="/puzzles/new"
            className="btn"
          >
            <Icon icon={Pencil} />
            Build a puzzle
          </a>
        </div>
      </Panel>
    </>
  );
});
