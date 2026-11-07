import clsx from "clsx/lite";
import { HTMLAttributes } from "preact";

import { STAR_ORDER, Stars } from "#/components/stars.tsx";
import { getTotalScore, type UserScore } from "#/game/score.ts";
import type { UserStats } from "#/game/streak.ts";

type Props = {
  stats: UserStats;
  userScore: UserScore;
} & HTMLAttributes<HTMLElement>;

export function StatsSummary({ stats, userScore, className }: Props) {
  const points = getTotalScore(userScore);

  return (
    <dl
      className={clsx(
        // Labels on one line, under numbers of different sizes
        "flex gap-fl-4 m-0 max-lg:items-end",
        "lg:flex-col lg:gap-fl-2",
        className,
      )}
    >
      <div className="flex flex-col">
        <dd className="m-0 text-5 font-semibold leading-flat tracking-wide text-brand">
          {stats.currentStreak}
          <span className="text-2 font-normal text-text-3">
            {" / "}
            {stats.bestStreak} <span className="max-sm:hidden">best</span>
          </span>
        </dd>
        <dt className="text-2 text-text-2">Streak</dt>
      </div>

      <div className="flex flex-col">
        <dd className="m-0 text-5 font-semibold tracking-wide leading-flat">
          <a
            href="/highscore"
            className="no-underline text-text-1 hover:text-link"
          >
            {points}
          </a>
        </dd>
        <dt className="text-2 text-text-2">Points</dt>
      </div>

      {points > 0 && (
        <div className="flex flex-col">
          <dd
            className={clsx(
              "m-0 flex items-center gap-2 text-text-1",
              "max-lg:text-4 max-lg:font-semibold max-lg:tracking-wide max-lg:leading-flat",
              "lg:flex-col lg:items-start lg:gap-0 lg:text-2",
            )}
          >
            {STAR_ORDER.filter((kind) => userScore[kind] > 0).map((kind) => (
              <span key={kind} className="flex items-center gap-1">
                <Stars kinds={[kind]} /> {userScore[kind]}
              </span>
            ))}
          </dd>
          <dt className="text-2 text-text-2">Stars</dt>
        </div>
      )}
    </dl>
  );
}
