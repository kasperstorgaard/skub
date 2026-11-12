import clsx from "clsx/lite";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { PillSwitch } from "#/components/pill-switch.tsx";
import { define } from "#/core.ts";
import { getHighscorePlacement, listHighscore } from "#/db/score.ts";
import { listPuzzleSolutions } from "#/db/solutions.ts";
import { getUserNames } from "#/db/user.ts";
import { getWeekPuzzleNumbers } from "#/game/date.ts";
import { getAvailableEntries, getPuzzle } from "#/game/loader.ts";
import {
  getHighscore,
  getPastScore,
  getTotalScore,
  type HighscoreEntry,
  SCORE_POINTS,
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
  /** The viewer's own row, when they have stars but aren't in the top rows. */
  viewerRow: (Row & { rank: number }) | null;
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
    const { userId, user } = ctx.state;
    const period: Period = ctx.url.searchParams.get("period") === "all"
      ? "all"
      : "week";

    let entries: HighscoreEntry[];
    let viewer: (HighscoreEntry & { rank: number }) | null = null;

    if (period === "week") {
      const highscore = await getWeekHighscore();
      entries = highscore.slice(0, LIMIT);
      const index = highscore.findIndex((entry) => entry.userId === userId);
      if (index >= LIMIT) viewer = { ...highscore[index], rank: index + 1 };
    } else {
      entries = await listHighscore({ limit: LIMIT });
      // Past the top rows, ranked from the hourly snapshot.
      const isListed = entries.some((entry) => entry.userId === userId);
      const placement = isListed ? null : await getHighscorePlacement(userId);
      if (placement) viewer = { userId, ...placement };
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
        <Header back={{ href: "/", label: "Back to home" }} hideHighscore />

        {/* The title, and how points are made under it */}
        <div className="flex flex-col gap-fl-1">
          <div className="flex items-center justify-between flex-wrap gap-fl-2">
            <h1 className="text-brand text-6 leading-flat">High score</h1>
            <PillSwitch
              label="Period"
              items={[
                {
                  label: "This week",
                  href: "/highscore",
                  isActive: period === "week",
                },
                {
                  label: "All time",
                  href: "/highscore?period=all",
                  isActive: period === "all",
                },
              ]}
            />
          </div>

          <p className="m-0 text-2 text-text-2">
            {formatNumber(SCORE_POINTS.solve)}{" "}
            pts per star. Your best solve on each day's puzzle counts.
          </p>
        </div>

        <div className="grid content-start gap-fl-4">
          {rows.length === 0
            ? (
              <p className="text-3 text-text-2">
                {period === "week"
                  ? "– No stars on this week's puzzles yet –"
                  : "– No stars earned yet –"}
              </p>
            )
            : (
              // One row per player, as the solutions list: a faint line
              // between, a sibling step either side
              <ol className="grid m-0 p-0 list-none divide-y divide-text-3/10">
                {rows.map((row, index) => (
                  <RowItem
                    key={row.userId}
                    row={row}
                    rank={index + 1}
                    isViewer={row.userId === userId}
                  />
                ))}

                {/* The viewer, past the top rows */}
                {viewerRow && (
                  <>
                    <li className="p-0 py-fl-2 text-text-3" aria-hidden="true">
                      …
                    </li>
                    <RowItem row={viewerRow} rank={viewerRow.rank} isViewer />
                  </>
                )}
              </ol>
            )}
        </div>
      </Main>

      <Panel />
    </>
  );
});

type RowItemProps = {
  row: Row;
  rank: number;
  isViewer: boolean;
};

/** One player: their spot, name over what their points are made of, points. */
function RowItem({ row, rank, isViewer }: RowItemProps) {
  return (
    <li className="grid grid-cols-[2rem_1fr_auto] items-baseline gap-x-fl-1 p-0 py-fl-2 first:pt-0 last:pb-0">
      <span className="text-4 tabular-nums text-text-3">{rank}</span>
      <div className="grid min-w-0">
        <Name
          name={row.name}
          isViewer={isViewer}
          className="text-4 font-medium"
        />
        <Breakdown userScore={row.userScore} />
      </div>
      <Points userScore={row.userScore} />
    </li>
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
    <dl className="flex flex-wrap gap-x-3 m-0 text-1">
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

type PointsProps = { userScore: UserScore };

/** On the name's line, as the solutions list's Watch. */
function Points({ userScore }: PointsProps) {
  return (
    <span className="text-4 font-semibold text-text-1 tabular-nums text-right">
      {formatNumber(getTotalScore(userScore))}
      {/* The unit, quiet: the stats beside it are numbers too */}
      <span className="ml-1 text-1 font-normal text-text-3">pts</span>
    </span>
  );
}
