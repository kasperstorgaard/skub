import clsx from "clsx/lite";
import { HTMLAttributes } from "preact";

import type { UserStats } from "#/game/streak.ts";

type Props = {
  stats: UserStats;
} & HTMLAttributes<HTMLElement>;

export function StatsSummary({ stats, className }: Props) {
  const optimalRate = stats.totalSolves > 0
    ? Math.round((stats.optimalSolves / stats.totalSolves) * 100)
    : 0;

  return (
    <dl className={clsx("flex flex-col gap-fl-2 m-0", className)}>
      <div className="flex flex-col">
        <dd className="m-0 text-5 font-semibold leading-flat tracking-wide text-brand">
          {stats.currentStreak}
          <span className="text-2 font-normal text-text-3">
            {" / "}
            {stats.bestStreak} best
          </span>
        </dd>
        <dt className="text-2 text-text-2">Streak</dt>
      </div>

      <div className="flex flex-col">
        <dd className="m-0 text-5 font-semibold tracking-wide leading-flat text-text-1">
          {stats.totalSolves}
        </dd>
        <dt className="text-2 text-text-2">Solves</dt>
      </div>

      <div className="flex flex-col">
        <dd className="m-0 text-5 font-semibold tracking-wide leading-flat text-text-1">
          {stats.optimalSolves}
          <span className="text-2 font-normal text-text-3">
            {" / "}
            {optimalRate}%
          </span>
        </dd>
        <dt className="text-2 text-text-2">Perfect</dt>
      </div>
    </dl>
  );
}
