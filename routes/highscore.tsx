import clsx from "clsx/lite";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";
import { listHighscore } from "#/db/score.ts";
import { listPuzzleSolutions } from "#/db/solutions.ts";
import { getUserNames } from "#/db/user.ts";
import { getWeekPuzzleNumbers } from "#/game/date.ts";
import { getAvailableEntries, getPuzzle } from "#/game/loader.ts";
import {
  getHighscore,
  getPastScore,
  getProgressScore,
  getTotalScore,
  type HighscoreEntry,
  type ScoreKind,
  type UserScore,
} from "#/game/score.ts";
import { formatNumber } from "#/lib/format.ts";

const LIMIT = 50;

type Period = "week" | "all";
type Row = HighscoreEntry & { name: string };

type PageData = {
  period: Period;
  rows: Row[];
  /**
   * The viewer's own row, when they have stars but aren't in the top rows.
   * Ranked only where it's known: this week, not all time.
   */
  viewerRow: (Row & { rank?: number }) | null;
};

/**
 * This week's highscore: the stars on this week's dailies, worked out from
 * their stored solutions in solve order, by the rules the awards use.
 */
async function getWeekHighscore(): Promise<HighscoreEntry[]> {
  const { from, to } = getWeekPuzzleNumbers();
  const entries = (await getAvailableEntries()).filter((entry) =>
    !entry.isFuture && entry.number !== undefined && entry.number >= from &&
    entry.number <= to
  );

  const scores = await Promise.all(entries.map(async (entry) => {
    const [puzzle, solutions] = await Promise.all([
      getPuzzle(entry.slug),
      listPuzzleSolutions(entry.slug, { limit: 1000 }),
    ]);
    if (!puzzle) return new Map<string, ScoreKind[]>();
    return getPastScore(
      puzzle,
      solutions.filter((solution) => solution.userId),
    );
  }));

  return getHighscore(scores);
}

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const { userId, user, score } = ctx.state;
    const period: Period = ctx.url.searchParams.get("period") === "all"
      ? "all"
      : "week";

    let entries: HighscoreEntry[];
    let viewer: (HighscoreEntry & { rank?: number }) | null = null;

    if (period === "week") {
      const highscore = await getWeekHighscore();
      entries = highscore.slice(0, LIMIT);
      const index = highscore.findIndex((entry) => entry.userId === userId);
      if (index >= LIMIT) viewer = { ...highscore[index], rank: index + 1 };
    } else {
      entries = await listHighscore({ limit: LIMIT });
      // Past the top rows, from the cookie: where they rank isn't known.
      const userScore = getProgressScore(score);
      const isListed = entries.some((entry) => entry.userId === userId);
      if (!isListed && getTotalScore(userScore) > 0) {
        viewer = { userId, userScore };
      }
    }

    const names = await getUserNames(entries.map((entry) => entry.userId));
    const rows = entries.map((entry) => ({
      ...entry,
      name: names.get(entry.userId) ?? "Anonymous",
    }));
    const viewerRow = viewer && { ...viewer, name: user.name ?? "You" };

    return page({ period, rows, viewerRow });
  },
});

export default define.page<typeof handler>(function HighscorePage(props) {
  const { period, rows, viewerRow } = props.data;
  const { userId } = props.state;

  return (
    <>
      <Main className="max-lg:row-span-full justify-stretch content-start">
        <Header back={{ href: "/", label: "Back to home" }} />

        <div className="flex items-center justify-between flex-wrap gap-fl-2">
          <h1 className="text-brand text-6 leading-flat">High score</h1>
          <PeriodTabs period={period} />
        </div>

        {rows.length === 0
          ? (
            <p className="text-3 text-text-2">
              {period === "week"
                ? "No stars on this week's puzzles yet."
                : "No stars earned yet."}
            </p>
          )
          : (
            <div className="grid content-start">
              {
                /* The top three, bigger and with what their points are made
                  of, a faint line between, a sibling step either side */
              }
              <ol className="grid m-0 p-0 list-none border-t border-text-3/10 divide-y divide-text-3/10">
                {rows.slice(0, 3).map((row, index) => (
                  <li
                    key={row.userId}
                    className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0 py-fl-2"
                  >
                    {/* The spot centred on the row, the points on its bottom line */}
                    <span className="self-center text-4 text-text-3 tabular-nums">
                      {index + 1}
                    </span>
                    <div className="grid min-w-0">
                      <Name
                        name={row.name}
                        isViewer={row.userId === userId}
                        className="text-4 font-medium"
                      />
                      <Breakdown userScore={row.userScore} />
                    </div>
                    <Points
                      userScore={row.userScore}
                      className="self-end text-4 font-semibold leading-flat"
                      showUnit
                    />
                  </li>
                ))}
              </ol>

              {(rows.length > 3 || viewerRow) && (
                <ol
                  start={4}
                  className="grid gap-1 m-0 p-0 pt-fl-2 list-none border-t border-text-3/10"
                >
                  {rows.slice(3).map((row, index) => (
                    <li
                      key={row.userId}
                      className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0 text-3"
                    >
                      <span className="text-text-3 tabular-nums">
                        {index + 4}
                      </span>
                      <Name
                        name={row.name}
                        isViewer={row.userId === userId}
                      />
                      <Points userScore={row.userScore} />
                    </li>
                  ))}

                  {/* The viewer, past the top rows */}
                  {viewerRow && (
                    <>
                      <li className="p-0 text-text-3" aria-hidden="true">
                        …
                      </li>
                      <li className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0 text-3">
                        <span className="text-text-3 tabular-nums">
                          {viewerRow.rank}
                        </span>
                        <Name name={viewerRow.name} isViewer />
                        <Points userScore={viewerRow.userScore} />
                      </li>
                    </>
                  )}
                </ol>
              )}
            </div>
          )}
      </Main>

      <Panel />
    </>
  );
});

const PERIODS: { period: Period; label: string; href: string }[] = [
  { period: "week", label: "This week", href: "/highscore" },
  { period: "all", label: "All time", href: "/highscore?period=all" },
];

/** This week or all time, a pill switch of links: the period lives in the URL. */
function PeriodTabs({ period }: { period: Period }) {
  return (
    <nav
      aria-label="Period"
      className="inline-flex p-1 rounded-round bg-surface-2"
    >
      {PERIODS.map((tab) => {
        const isActive = tab.period === period;
        return (
          <a
            key={tab.period}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            // Active: an action button's ring and tint, sized down to a pill.
            // The other keeps a clear border as wide, so it's as tall, and
            // half the padding towards the active one.
            className={clsx(
              // Taller on mobile, for thumbs
              "py-1 max-lg:py-2 rounded-round",
              "text-1 no-underline whitespace-nowrap",
              isActive
                ? "btn px-3 min-h-0 min-w-0 font-normal tracking-normal"
                : clsx(
                  "first:pl-2 first:pr-1 last:pl-1 last:pr-2",
                  "border-[3px] border-transparent",
                  "text-text-2 hover:text-text-1",
                ),
            )}
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}

type NameProps = { name: string; isViewer: boolean; className?: string };

/** A player's name, in the brand colour for the viewer's own. */
function Name({ name, isViewer, className }: NameProps) {
  return (
    <span
      className={clsx(
        "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
        isViewer ? "text-brand" : "text-text-1",
        className,
      )}
    >
      {name}
    </span>
  );
}

// Per puzzle, not per solution: each puzzle adds its best solution's kinds
// once. Flash counts as solved here, no kind of its own.
const BREAKDOWN = [
  { kind: "solve", label: "Solved" },
  { kind: "perfect", label: "Perfect" },
  { kind: "first", label: "Pioneer" },
] as const;

/** What a player's points are made of, on one line: "10 Solved 4 Perfect". */
function Breakdown({ userScore }: { userScore: UserScore }) {
  const counts = { ...userScore, solve: userScore.solve + userScore.flash };

  return (
    <dl className="flex flex-wrap gap-x-3 m-0 text-2">
      {BREAKDOWN.filter(({ kind }) => counts[kind] > 0).map((
        { kind, label },
      ) => (
        <div key={kind} className="flex gap-1">
          <dd className="m-0 font-semibold tabular-nums text-text-2">
            {formatNumber(counts[kind])}
          </dd>
          <dt className="text-text-3">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

type PointsProps = {
  userScore: UserScore;
  /** "pts" after the number: on the podium; the list below follows it */
  showUnit?: boolean;
  className?: string;
};

function Points({ userScore, showUnit, className }: PointsProps) {
  return (
    <span className={clsx("text-text-1 tabular-nums text-right", className)}>
      {formatNumber(getTotalScore(userScore))}
      {/* The unit, quiet: the stats beside it are numbers too */}
      {showUnit && (
        <span className="ml-1 text-1 font-normal text-text-3">pts</span>
      )}
    </span>
  );
}
