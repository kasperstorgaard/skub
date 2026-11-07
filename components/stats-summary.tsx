import clsx from "clsx/lite";
import { HTMLAttributes } from "preact";

import { Stars } from "#/components/stars.tsx";
import { getTotalScore, type UserScore } from "#/game/score.ts";
import type { UserStats } from "#/game/streak.ts";
import { formatNumber } from "#/lib/format.ts";

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

  const stars = STAT_KINDS.filter((kind) => counts[kind] > 0);

  // Streak, points and the stars as three groups, the stars close together
  // within theirs. A dl each: a div can only wrap a single term in one.
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

      <dl className="flex flex-col m-0">
        <dd className="m-0">
          {
            /* Sized on the link, a block so its leading is the line's: links
            default to body size */
          }
          <a
            href="/highscore"
            className="block text-4 lg:text-5 font-semibold tracking-wide leading-flat no-underline text-text-1 hover:text-link"
          >
            {formatNumber(points)}
          </a>
        </dd>
        <dt className="text-2 text-text-2">Points</dt>
      </dl>

      {stars.length > 0 && (
        <dl className="flex gap-fl-2 m-0 max-lg:items-end lg:flex-col lg:gap-0">
          {stars.map((kind) => (
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
      )}
    </div>
  );
}
