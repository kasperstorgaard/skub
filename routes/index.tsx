import clsx from "clsx/lite";
import { HttpError, page } from "fresh";

import { Header } from "#/components/header.tsx";
import { ArrowRight, ChalkboardTeacher, Icon } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { PanelCredits } from "#/components/panel-credits.tsx";
import { PanelLinks } from "#/components/panel-links.tsx";
import { Panel } from "#/components/panel.tsx";
import { PuzzleCard, PuzzleCardCaption } from "#/components/puzzle-card.tsx";
import { StatsSummary } from "#/components/stats-summary.tsx";
import { define } from "#/core.ts";
import { getAvailableEntries, getTodaysPuzzle } from "#/game/loader.ts";
import { pickRecommendedPuzzle } from "#/game/recommendation.ts";
import { computeUserStats, type UserStats } from "#/game/streak.ts";
import type { Puzzle } from "#/game/types.ts";

type PageData = {
  dailyPuzzle: Puzzle;
  recommendedPuzzle: Puzzle;
  bestMoves: Record<string, number>;
  userStats: UserStats | null;
};

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    const { user, progress: bestMoves } = ctx.state;

    const [dailyPuzzle, recommendedPuzzle, entries] = await Promise.all([
      getTodaysPuzzle(),
      pickRecommendedPuzzle(user, bestMoves),
      getAvailableEntries(),
    ]);

    if (!dailyPuzzle) throw new HttpError(500, "Unable to get daily puzzle");

    const userStats = computeUserStats(entries, bestMoves);

    return page({
      dailyPuzzle,
      recommendedPuzzle,
      bestMoves,
      userStats: userStats.totalSolves > 0 ? userStats : null,
    });
  },
});

export default define.page<typeof handler>(function Home(ctx) {
  const {
    dailyPuzzle,
    recommendedPuzzle,
    bestMoves,
    userStats,
  } = ctx.data;
  const { user } = ctx.state;

  return (
    <>
      <Main className="items-stretch place-content-stretch">
        <Header />

        <div className="title-card flex flex-col">
          <h1 className="text-8 leading-tight text-brand flex items-baseline gap-fl-1">
            <span className="wordmark" data-text="Skub">
              {/* One span per letter, so the load ripple can stagger them */}
              <span>
                {[..."Skub"].map((letter, index, letters) => (
                  <span
                    key={index}
                    className="wordmark-letter"
                    style={{
                      "--delay": `${
                        0.5 + (index * 0.5) / (letters.length - 1)
                      }s`,
                    }}
                  >
                    {letter}
                  </span>
                ))}
              </span>
            </span>
            <span className="text-1 text-text-3">
              [ˈsgɔb]
            </span>
          </h1>

          <p className="text-text-2">
            Slide the puck to the target.<br />Fewest moves wins.
          </p>
        </div>

        <div className="grid content-start gap-fl-2">
          <ul className="grid grid-cols-[repeat(2,1fr)] gap-fl-4 list-none pl-0">
            <li className="list-none pl-0 min-w-0">
              <PuzzleCard
                puzzle={dailyPuzzle}
                tagline="Daily puzzle"
                bestMoves={bestMoves[dailyPuzzle.slug]}
              />
            </li>

            <li className="list-none pl-0 min-w-0">
              {user.skillLevel === null && (
                <a
                  href="/puzzles/tutorial"
                  className="puzzle-card group flex flex-col gap-2 text-text-1 no-underline"
                >
                  <div
                    className={clsx(
                      "puzzle-card-thumb group flex gap-fl-1 p-fl-3 place-content-center place-items-center",
                      "text-3 text-text-2 border-2 border-link rounded-1 no-underline",
                      "aspect-square lg:flex-col lg:gap-fl-1 lg:w-full",
                      "hover:filter-[lighten(1.3)] hover:no-underline",
                    )}
                  >
                    <span className="flex gap-2 text-6">
                      <Icon icon={ChalkboardTeacher} />
                    </span>
                  </div>

                  <PuzzleCardCaption tagline="New here?">
                    <span className="type-title">
                      Learn the basics
                    </span>
                  </PuzzleCardCaption>
                </a>
              )}

              {user.skillLevel && recommendedPuzzle.onboardingLevel && (
                <PuzzleCard
                  puzzle={recommendedPuzzle}
                  tagline={recommendedPuzzle.onboardingLevel === 2
                    ? "Starter puzzle"
                    : "Quick puzzle"}
                />
              )}

              {user.skillLevel && !recommendedPuzzle.onboardingLevel && (
                <PuzzleCard
                  puzzle={recommendedPuzzle}
                  tagline="Random puzzle"
                  bestMoves={bestMoves[recommendedPuzzle.slug]}
                />
              )}
            </li>
          </ul>

          <a href="/puzzles" className="btn place-self-start" data-size="lg">
            Archives <Icon icon={ArrowRight} />
          </a>
        </div>
      </Main>

      <Panel className="max-lg:gap-y-fl-4">
        <PanelCredits />

        <div
          className={clsx(
            "col-[2/3] flex flex-col gap-fl-4 justify-between items-start text-2 text-text-2",
            "lg:col-auto lg:row-start-3 lg:justify-between lg:self-stretch",
          )}
        >
          {userStats && (
            <StatsSummary stats={userStats} className="lg:w-full" />
          )}

          <PanelLinks />
        </div>
      </Panel>
    </>
  );
});
