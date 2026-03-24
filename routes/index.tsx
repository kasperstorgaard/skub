import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import {
  ArrowRight,
  ChalkboardTeacher,
  GithubLogo,
  Icon,
  LinkedinLogo,
} from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleCard } from "#/components/puzzle-card.tsx";
import { StatsSummary } from "#/components/stats-summary.tsx";
import { define } from "#/core.ts";
import { getBestMoves, listUserSolutions } from "#/db/solutions.ts";
import { getUserStats } from "#/db/stats.ts";
import { getLatestPuzzle, getPuzzle, getRandomPuzzle } from "#/game/loader.ts";
import type { UserStats } from "#/game/streak.ts";
import { Puzzle } from "#/game/types.ts";

type PageData = {
  dailyPuzzle: Puzzle;
  randomPuzzle: Puzzle;
  bestMoves: Record<string, number>;
  userStats: UserStats | null;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const { user } = ctx.state;

    const [dailyPuzzle, userSolutions, userStats] = await Promise.all([
      getLatestPuzzle(),
      listUserSolutions(ctx.state.userId, { limit: 500 }),
      getUserStats(ctx.state.userId),
    ]);

    if (!dailyPuzzle) throw new HttpError(500, "Unable to get daily puzzle");

    let randomPuzzle: Puzzle | null;
    if (user.onboarding === "started") {
      randomPuzzle = await getPuzzle("karla");
    } else {
      randomPuzzle = await getRandomPuzzle({
        excludeSlugs: [dailyPuzzle.slug],
      });
    }

    if (!randomPuzzle) throw new HttpError(500, "Unable to get random puzzle");

    // TODO: add direct db filtering for this
    const relevantSolutions = userSolutions.filter((solution) =>
      solution.puzzleSlug === dailyPuzzle.slug ||
      solution.puzzleSlug === randomPuzzle.slug
    );

    const bestMoves = getBestMoves(relevantSolutions);

    return page({
      dailyPuzzle,
      randomPuzzle,
      bestMoves,
      userStats: userStats.totalSolves > 0 ? userStats : null,
    });
  },
});

export default define.page<typeof handler>(function Home(ctx) {
  const url = new URL(ctx.req.url);

  const { dailyPuzzle, randomPuzzle, bestMoves, userStats } = ctx.data;
  const { user } = ctx.state;

  return (
    <>
      <Main className="max-lg:row-span-full items-stretch place-content-stretch">
        <Header url={url} share />

        <div className="flex flex-col">
          <h1 className="text-8 leading-tight text-brand flex items-baseline gap-fl-1">
            <span>
              Skub
            </span>
            <span className="text-1 text-text-3">
              [ˈsgɔb]
            </span>
          </h1>

          <p className="text-text-2">
            Slide the puck to the target.<br />Fewest moves wins.
          </p>
        </div>

        <div className="grid gap-fl-2">
          <ul className="grid grid-cols-[repeat(2,1fr)] gap-fl-3 gap-y-fl-4 list-none pl-0 max-w-120">
            <li className="list-none pl-0 min-w-0">
              <PuzzleCard
                puzzle={dailyPuzzle}
                tagline="Daily puzzle"
                bestMoves={bestMoves[dailyPuzzle.slug]}
              />
            </li>

            <li className="list-none pl-0 min-w-0">
              {user.onboarding === "new"
                ? (
                  <a
                    href="/puzzles/tutorial"
                    className="flex flex-col gap-2 text-text-1 no-underline"
                  >
                    <div
                      className={clsx(
                        "group flex gap-fl-1 p-fl-3 place-content-center place-items-center",
                        "text-3 text-text-2 border-2 border-link rounded-1 no-underline",
                        "aspect-square lg:flex-col lg:gap-fl-1 lg:w-full",
                        "hover:filter-[lighten(1.3)] hover:no-underline",
                      )}
                    >
                      <span className="flex gap-2 text-6">
                        <Icon icon={ChalkboardTeacher} />
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-1 text-text-2 tracking-wide leading-tight">
                        New here?
                      </span>
                      <span className="text-text-1 text-3 font-semibold leading-flat items-center">
                        Learn the basics
                      </span>
                    </div>
                  </a>
                )
                : (
                  <PuzzleCard
                    puzzle={randomPuzzle!}
                    tagline={user.onboarding === "started"
                      ? "Warm-up puzzle"
                      : "Random puzzle"}
                    bestMoves={bestMoves[randomPuzzle.slug]}
                  />
                )}
            </li>
          </ul>

          <a href="/puzzles" className="btn place-self-start" data-size="lg">
            Archives <Icon icon={ArrowRight} />
          </a>
        </div>
      </Main>

      <Panel className="max-lg:gap-fl-3">
        <p
          className={clsx(
            "col-[2/3]",
            "text-text-1 text-fl-1",
            "lg:col-auto lg:row-start-1 lg:text-fl-0",
          )}
        >
          Inspired by <br />
          <a
            href="https://boardgamegeek.com/boardgame/51/ricochet-robots"
            className="text-2 text-text-2"
          >
            Ricochet Robots
          </a>
        </p>

        <div
          className={clsx(
            "col-[2/3] flex flex-col gap-fl-3 justify-between items-start text-2 text-text-2",
            "lg:col-auto lg:row-start-3 lg:justify-between lg:self-stretch",
          )}
        >
          {userStats && (
            <StatsSummary stats={userStats} className="lg:w-full" />
          )}

          <div className="flex gap-2 lg:flex-col lg:mt-auto">
            <a
              href="https://github.com/kasperstorgaard/ricochet"
              className="flex gap-1 text-text-2"
            >
              <Icon icon={GithubLogo} />GitHub
            </a>
            <a
              href="https://www.linkedin.com/in/kasper-storgaard-t-lead"
              className="flex gap-1 text-text-2"
            >
              <Icon icon={LinkedinLogo} />LinkedIn
            </a>
          </div>
        </div>
      </Panel>
    </>
  );
});
