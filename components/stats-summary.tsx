import clsx from "clsx/lite";
import { HTMLAttributes } from "preact";

import { Stars } from "#/components/stars.tsx";
import { getTotalScore, type UserScore } from "#/game/score.ts";
import type { UserStats } from "#/game/streak.ts";

// A Flash solve counts as solved here, no star of its own.
const STAR_LABELS = {
  solve: "Solved",
  perfect: "Perfect",
  first: "Unique",
} as const;
const STAT_KINDS = ["solve", "perfect", "first"] as const;

type Props = {
  stats: UserStats;
  userScore: UserScore;
} & HTMLAttributes<HTMLElement>;

export function StatsSummary({ stats, userScore, className }: Props) {
  const points = getTotalScore(userScore);
  const counts = { ...userScore, solve: userScore.solve + userScore.flash };

  return (
    <dl
      className={clsx(
        // Labels on one line, under numbers of different sizes
        "flex flex-wrap gap-x-fl-4 gap-y-fl-2 m-0 max-lg:items-end",
        "lg:flex-col lg:gap-y-fl-2",
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

      {STAT_KINDS.filter((kind) => counts[kind] > 0).map((kind) => (
        <div
          key={kind}
          className="flex flex-col lg:flex-row lg:items-baseline lg:gap-2"
        >
          <dd
            className={clsx(
              "m-0 flex items-center gap-1 text-text-1",
              "max-lg:text-4 max-lg:font-semibold max-lg:tracking-wide max-lg:leading-flat",
              "lg:text-2",
            )}
          >
            <Stars kinds={[kind]} /> {counts[kind]}
          </dd>
          <dt className="text-2 text-text-2">{STAR_LABELS[kind]}</dt>
        </div>
      ))}
    </dl>
  );
}
