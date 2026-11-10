import clsx from "clsx/lite";
import { HTMLAttributes } from "preact";

import { getTotalScore, type UserScore } from "#/game/score.ts";
import type { UserStats } from "#/game/streak.ts";
import { formatNumber } from "#/lib/format.ts";

// A Flash solve counts as solved here, no kind of its own.
const STAR_LABELS = {
  solve: "Solved",
  perfect: "Perfect",
  first: "Pioneer",
} as const;
const STAT_KINDS = ["solve", "perfect", "first"] as const;

type Props = {
  stats: UserStats;
  userScore: UserScore;
  /** Drop the points, leaving the stars they're made of */
  hidePoints?: boolean;
} & HTMLAttributes<HTMLElement>;

export function StatsSummary(
  { stats, userScore, hidePoints, className }: Props,
) {
  const points = getTotalScore(userScore);
  const counts = { ...userScore, solve: userScore.solve + userScore.flash };

  const stars = STAT_KINDS.filter((kind) => counts[kind] > 0);

  // Streak, points and what they're made of as three groups, each a number
  // over its label; the kinds close together within theirs. A dl each: a div
  // can only wrap a single term in one.
  return (
    <div
      className={clsx(
        // Labels on one line, under numbers of different sizes
        "flex flex-wrap gap-x-fl-4 gap-y-fl-2 max-lg:items-end",
        "lg:flex-col lg:gap-y-fl-2",
        className,
      )}
    >
      <dl className="flex flex-col m-0">
        <dd className="m-0 text-4 lg:text-5 font-semibold leading-flat tracking-wide text-brand">
          {stats.currentStreak}
        </dd>
        <dt className="text-2 text-text-2">Streak</dt>
      </dl>

      {!hidePoints && (
        <dl className="flex flex-col m-0">
          <dd className="m-0 text-4 lg:text-5 font-semibold tracking-wide leading-flat text-text-1">
            {formatNumber(points)}
          </dd>
          <dt className="text-2 text-text-2">Points</dt>
        </dl>
      )}

      {stars.length > 0 && (
        <dl className="flex gap-fl-2 m-0 max-lg:items-end lg:flex-col lg:gap-2">
          {stars.map((kind) => (
            <div key={kind} className="flex flex-col">
              <dd className="m-0 text-4 lg:text-5 font-semibold tracking-wide leading-flat text-text-1">
                {formatNumber(counts[kind])}
              </dd>
              <dt className="text-2 text-text-2">{STAR_LABELS[kind]}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
