import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Icon, Play, Trophy } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { PillSwitch } from "#/components/pill-switch.tsx";
import { PuzzleName } from "#/components/puzzle-name.tsx";
import { BadgeStars } from "#/components/stars.tsx";
import {
  getCanonicalGroup,
  listCanonicalGroups,
  listPathSolutions,
  listPuzzleSolutions,
  listUserPuzzleSolutions,
} from "#/db/solutions.ts";
import type { CanonicalGroup, Solution } from "#/db/types.ts";
import { getPathGroups } from "#/game/paths.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";
import type { Puzzle } from "#/game/types.ts";
import { ScoreBadge } from "#/islands/score-badge.tsx";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

type Tab = "solutions" | "flash";

// Paths shown, and players under each path's claimer.
const PATHS = 6;
const PLAYERS = 5;

/** A path as the page lists it: who claimed it, and who found it after. */
type Path = {
  canonicalKey: string;
  moves: number;
  claimer: Solution;
  others: Solution[];
  /** Players on the path past the ones shown */
  more: number;
};

type Data = {
  puzzle: Puzzle;
  tab: Tab;
  paths: Path[];
  /** The viewer's latest path, when it isn't among the shown ones */
  extraPath: Path | null;
  userCanonicalKeys: string[];
  /** The player's best regular solve, for the score badge */
  bestMoves: number | null;
};

function toPath(
  canonicalKey: string,
  solutions: Solution[],
  options: { moves: number; count: number },
): Path {
  const [claimer, ...rest] = solutions;
  const others = rest.slice(0, PLAYERS);
  return {
    canonicalKey,
    moves: options.moves,
    claimer,
    others,
    more: Math.max(options.count - 1 - others.length, 0),
  };
}

/** A path from the stored aggregate, with its players read from the path. */
async function getGroupPath(slug: string, group: CanonicalGroup) {
  const solutions = await listPathSolutions(slug, group.canonicalKey, {
    // Room for Flash solves of the same moves, which are left out
    limit: PLAYERS * 2 + 2,
  });
  return toPath(
    group.canonicalKey,
    solutions.length ? solutions : [group.firstSolution],
    { moves: group.firstSolution.moves.length, count: group.count },
  );
}

export const handler = define.handlers<Data>({
  async GET(ctx) {
    const { slug } = ctx.params;
    const { puzzle, userId } = ctx.state;
    const hasFlash = !!puzzle.flashStart?.length;
    const tab: Tab = hasFlash && ctx.url.searchParams.get("tab") === "flash"
      ? "flash"
      : "solutions";
    // Flash paths are told apart, and counted, from the Flash start.
    const skip = tab === "flash" ? puzzle.flashStart?.length ?? 0 : 0;

    const allUserSolutions = await listUserPuzzleSolutions(userId, slug, {
      limit: 100,
    });
    const userSolutions = allUserSolutions.filter((solution) =>
      tab === "flash" ? solution.flash : !solution.flash
    );
    const userCanonicalKeys = [
      ...new Set(
        userSolutions.map((solution) =>
          getCanonicalMoveKey(solution.moves.slice(skip))
        ),
      ),
    ];
    const latestKey = userCanonicalKeys.at(-1);

    let paths: Path[];
    let extraPath: Path | null = null;

    if (tab === "solutions") {
      const groups = await listCanonicalGroups(slug, { limit: PATHS });
      paths = await Promise.all(
        groups.map((group) => getGroupPath(slug, group)),
      );

      const latest = userSolutions.at(-1);
      if (latest && !paths.some((path) => path.canonicalKey === latestKey)) {
        const group = await getCanonicalGroup(latest);
        if (group) extraPath = await getGroupPath(slug, group);
      }
    } else {
      // Flash solves aren't in the aggregates: grouped from the solves.
      const solutions = await listPuzzleSolutions(slug, { limit: 1000 });
      const groups = getPathGroups(
        solutions.filter((solution) => solution.flash),
        { skip },
      ).map((group) =>
        toPath(group.canonicalKey, group.solutions, {
          moves: group.moves,
          count: group.solutions.length,
        })
      );

      paths = groups.slice(0, PATHS);
      if (latestKey && !paths.some((path) => path.canonicalKey === latestKey)) {
        extraPath = groups.find((path) => path.canonicalKey === latestKey) ??
          null;
      }
    }

    const regularSolutions = allUserSolutions.filter((solution) =>
      !solution.flash
    );
    const bestMoves = regularSolutions.length
      ? Math.min(...regularSolutions.map((solution) => solution.moves.length))
      : null;

    return page({
      puzzle,
      tab,
      paths,
      extraPath,
      userCanonicalKeys,
      bestMoves,
    });
  },
});

export default define.page<typeof handler>(function SolutionsListPage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const href = useSignal(props.url.href);
  const { tab, paths, extraPath, userCanonicalKeys } = props.data;
  const { slug, flashStart } = props.data.puzzle;
  const solutionsHref = `/puzzles/${slug}/solutions`;
  // The shortest a path can be on this tab: Flash counts from its start.
  const minMoves = props.data.puzzle.minMoves -
    (tab === "flash" ? flashStart?.length ?? 0 : 0);

  const pathProps = {
    solutionsHref,
    minMoves,
    userId: props.state.userId,
    userCanonicalKeys,
  };

  return (
    <>
      <Main className="justify-stretch content-start min-h-96">
        <Header back={{ href: `/puzzles/${slug}` }} />

        <div className="flex items-end justify-between flex-wrap gap-fl-1">
          <h1 className="text-text-1">
            <PuzzleName puzzle={props.data.puzzle} lead="Solutions" />
          </h1>

          <BadgeStars kinds={props.state.score[slug]}>
            <ScoreBadge
              puzzle={puzzle}
              href={href}
              moves={props.data.bestMoves}
            />
          </BadgeStars>
        </div>

        <div className="grid content-start gap-fl-4">
          {!!flashStart?.length && (
            <PillSwitch
              label="Solutions"
              className="place-self-start"
              items={[
                {
                  label: "Solutions",
                  href: solutionsHref,
                  isActive: tab === "solutions",
                },
                {
                  label: "Flash",
                  href: `${solutionsHref}?tab=flash`,
                  isActive: tab === "flash",
                },
              ]}
            />
          )}

          {paths.length === 0
            ? (
              <p className="text-3 text-text-2">
                {tab === "flash"
                  ? "No Flash solutions yet."
                  : "No solutions yet."}
              </p>
            )
            : (
              <ol className="grid gap-fl-3 m-0 p-0 list-none">
                {paths.map((path) => (
                  <PathItem
                    key={path.canonicalKey}
                    path={path}
                    {...pathProps}
                  />
                ))}

                {extraPath && (
                  <>
                    <li className="p-0 text-text-3" aria-hidden="true">…</li>
                    <PathItem path={extraPath} {...pathProps} />
                  </>
                )}
              </ol>
            )}
        </div>
      </Main>

      <Panel>
        <div className="col-[2/3] flex items-start lg:col-auto lg:row-start-3">
          <a href="/highscore" className="btn">
            <Icon icon={Trophy} /> High score
          </a>
        </div>
      </Panel>
    </>
  );
});

type PathItemProps = {
  path: Path;
  solutionsHref: string;
  minMoves: number;
  userId: string;
  userCanonicalKeys: string[];
};

/**
 * One path: its moves, the player who claimed it, podium style, and the ones
 * who found it after, then Watch.
 */
function PathItem(
  { path, solutionsHref, minMoves, userId, userCanonicalKeys }: PathItemProps,
) {
  const isPerfect = path.moves <= minMoves;
  const isFound = userCanonicalKeys.includes(path.canonicalKey);
  const isShown = [path.claimer, ...path.others].some((solution) =>
    solution.userId === userId
  );
  // The viewer found it but isn't among the names: say so, out of the rest.
  const showsYou = isFound && !isShown;
  const more = showsYou ? Math.max(path.more - 1, 0) : path.more;

  return (
    <li className="grid grid-cols-[3rem_1fr_auto] items-center gap-x-fl-1 p-0">
      <span className="flex flex-col items-center leading-flat">
        {/* At the shortest, the puck's colour, like the badge */}
        <span
          className={clsx(
            "text-4 tabular-nums",
            isPerfect ? "text-ui-2" : "text-text-1",
          )}
        >
          {path.moves}
        </span>
        <span className="text-0 text-text-3">moves</span>
      </span>

      <span className="grid min-w-0">
        <Name
          name={path.claimer.name}
          isViewer={path.claimer.userId === userId}
          className="text-4 font-medium"
        />

        {(path.others.length > 0 || showsYou || more > 0) && (
          <span className="text-1 text-text-3 overflow-hidden text-ellipsis whitespace-nowrap">
            {path.others.map((solution, index) => (
              <span key={solution.id}>
                {index > 0 && ", "}
                <span
                  className={clsx(solution.userId === userId && "text-brand")}
                >
                  {solution.name}
                </span>
              </span>
            ))}
            {showsYou && (
              <>
                {path.others.length > 0 && ", "}
                <span className="text-brand">you</span>
              </>
            )}
            {more > 0 && ` and ${more} more`}
          </span>
        )}
      </span>

      <a href={`${solutionsHref}/${path.claimer.id}`} className="btn min-w-0">
        Watch <Icon icon={Play} />
      </a>
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
