import { useSignal } from "@preact/signals";
import clsx from "clsx/lite";
import { page } from "fresh";
import { useMemo } from "preact/hooks";

import { Header } from "#/components/header.tsx";
import { Icon, Play, Shuffle, Trophy } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import {
  getCanonicalGroup,
  listCanonicalGroups,
  listUserPuzzleSolutions,
} from "#/db/solutions.ts";
import { CanonicalGroup } from "#/db/types.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";
import { Puzzle } from "#/game/types.ts";
import { DifficultyBadge } from "#/islands/difficulty-badge.tsx";
import { define } from "#/routes/puzzles/[slug]/_middleware.ts";

type Data = {
  puzzle: Puzzle;
  groups: CanonicalGroup[];
  extraGroup: CanonicalGroup | null;
  userCanonicalKeys: string[];
  userId: string;
};

export const handler = define.handlers<Data>({
  async GET(ctx) {
    const { slug } = ctx.params;
    const { puzzle, userId } = ctx.state;
    const userCanonicalKeys: string[] = [];

    const [groups, userSolutions] = await Promise.all([
      listCanonicalGroups(slug, { limit: 6 }),
      listUserPuzzleSolutions(userId, slug, { limit: 100 }),
    ]);

    const groupKeySet = new Set(groups.map((g) => g.canonicalKey));

    for (const solution of userSolutions) {
      const moveKey = getCanonicalMoveKey(solution.moves);
      if (!userCanonicalKeys.includes(moveKey)) {
        userCanonicalKeys.push(moveKey);
      }
    }

    // Show the latest user solution's group after … if it didn't make the top 6
    let extraGroup: CanonicalGroup | null = null;
    const latestSolution = userSolutions[userSolutions.length - 1];

    if (latestSolution) {
      const moveKey = getCanonicalMoveKey(latestSolution.moves);

      if (!groupKeySet.has(moveKey)) {
        extraGroup = await getCanonicalGroup(latestSolution);
      }
    }

    return page({ puzzle, groups, extraGroup, userCanonicalKeys, userId });
  },
});

type SolutionRowProps = {
  group: CanonicalGroup;
  solutionsHref: string;
  userCanonicalKeys: string[];
  minMoves: number | undefined;
};

export default define.page<typeof handler>(function SolutionsListPage(props) {
  const puzzle = useSignal(props.data.puzzle);
  const url = new URL(props.req.url);
  const { groups, extraGroup, userCanonicalKeys } = props.data;
  const minMoves = props.data.puzzle.minMoves;
  const solutionsHref = `/puzzles/${props.data.puzzle.slug}/solutions`;
  const backHref = `/puzzles/${props.data.puzzle.slug}`;

  const visibleGroups: (CanonicalGroup | null)[] = extraGroup
    ? [...groups.slice(0, 5), null, extraGroup]
    : groups;

  return (
    <>
      <Main className="justify-stretch min-h-96">
        <Header
          url={url}
          back={{ href: backHref }}
        />

        <div className="flex items-center justify-between mt-2 flex-wrap gap-fl-1">
          <div className="flex flex-col">
            <h1 className="text-5 text-brand leading-flat">
              {props.data.puzzle.number && `#${props.data.puzzle.number} `}
              {props.data.puzzle.name}
            </h1>

            <p className="text-text-3 ml-1">
              solves
            </p>
          </div>

          <DifficultyBadge puzzle={puzzle} />
        </div>

        {
          /*
          TODO: 3-tab layout with separate pages:
          - /solutions           → scoreboard (this page)
          - /solutions/mine      → my-solutions (all canonical groups the user has found)
          - /solutions/stats     → stats (move distribution histogram, needs PuzzleStats in page data)
          Tabs rendered as nav links at the top of Main, active tab highlighted.
        */
        }
        {
          /*
          TODO: solutions page rewrite — currently hard to find your own solve
          in the list. Should highlight the user's row, scroll to it, or surface
          it separately. Consider as a follow-up to the celebration flow.
        */
        }
        <div className="mt-fl-2">
          {visibleGroups.length === 0
            ? (
              // TODO: improve empty state — currently too sparse with Remix isolated in corner
              <p className="text-3 text-text-2">
                No solves posted yet.
              </p>
            )
            : (
              <ol className="m-0 p-0 list-none flex flex-col gap-y-2 w-full">
                {visibleGroups.map((group) =>
                  group === null
                    ? (
                      <li
                        key="delimiter"
                        className="p-0 text-text-3 text-fl-0 px-fl-1 pr-fl-2"
                      >
                        …
                      </li>
                    )
                    : (
                      <SolutionRow
                        key={group.canonicalKey}
                        group={group}
                        solutionsHref={solutionsHref}
                        userCanonicalKeys={userCanonicalKeys}
                        minMoves={minMoves}
                      />
                    )
                )}
              </ol>
            )}
        </div>
      </Main>

      <Panel>
        <div
          className={clsx(
            "max-lg:col-[2/3] flex flex-col gap-fl-2 items-start place-content-end w-full",
            "lg:row-[3/4] lg:gap-fl-3 lg:grid lg:grid-cols-1",
          )}
        >
          <a
            href={`/puzzles/${puzzle.value.slug}/clone`}
            className="btn"
          >
            <Icon icon={Shuffle} /> Remix
          </a>
        </div>
      </Panel>
    </>
  );
});

function SolutionRow(
  { group, solutionsHref, userCanonicalKeys, minMoves }: SolutionRowProps,
) {
  const isFound = userCanonicalKeys.includes(group.canonicalKey);
  const isOptimal = minMoves != null &&
    group.firstSolution.moves.length === minMoves;
  const others = Math.max(group.count - 1, 0);

  const metaLine = useMemo(() => {
    // You are the other one
    if (isFound && others === 1) return "+ you";

    if (isFound && others > 1) {
      // offset others by 1 more, as "you" counts for 1
      return `+ you and ${others - 1} ${others - 1 === 1 ? "other" : "others"}`;
    }

    if (others === 0) return "unique solve";

    return `+ ${others} ${others === 1 ? "other" : "others"}`;
  }, [isFound, others]);

  return (
    <li className="p-0">
      <a
        href={`${solutionsHref}/${group.firstSolution.id}`}
        className={clsx(
          "group grid grid-cols-[3rem_1fr_auto] items-center gap-x-fl-1",
          "px-fl-1 pr-fl-2 py-2 rounded-2 no-underline",
          "bg-surface-3/20 border-text-3/20 border-1 border-l-3 border-l-text-3",
          "hover:brightness-(--hover-brightness)",
          "data-found:border-l-brand",
        )}
        data-found={isFound ? true : undefined}
      >
        <div className="flex flex-col items-center">
          <span className="font-5 text-4 text-text-1 leading-flat">
            {group.firstSolution.moves.length}
          </span>
          <span className="text-0 text-text-3 mt-0.5">moves</span>
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-3 text-text-2 overflow-hidden text-ellipsis whitespace-nowrap">
              {group.firstSolution.name}
            </span>

            {isOptimal && (
              <span
                className={clsx(
                  "flex items-center shrink-0 gap-0.5 text-0 px-1 py-px",
                  "rounded-1 bg-ui-2/10 border border-ui-2/20 text-ui-2 whitespace-nowrap leading-tight",
                )}
              >
                <Icon icon={Trophy} /> perfect
              </span>
            )}
          </div>
          <p className="text-text-3 text-1 leading-snug">{metaLine}</p>
        </div>

        <span className="flex gap-1 items-center text-link">
          <span className="max-md:hidden">Watch</span>
          <Icon icon={Play} />
        </span>
      </a>
    </li>
  );
}
