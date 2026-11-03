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
    <dl
      className={clsx(
        "flex gap-fl-4 m-0",
        "lg:flex-col lg:gap-fl-2",
        className,
      )}
    >
      <Stat
        value={stats.currentStreak}
        label="Streak"
        detail={`best ${stats.bestStreak}`}
        className="text-brand"
      />
      <Stat value={stats.totalSolves} label="Solves" />
      <Stat
        value={stats.optimalSolves}
        label="Perfect"
        detail={`${optimalRate}%`}
      />
    </dl>
  );
}

type StatProps = {
  value: number;
  label: string;
  /** Muted qualifier next to the label, e.g. "best 12" or "64%" */
  detail?: string;
  className?: string;
};

function Stat({ value, label, detail, className }: StatProps) {
  return (
    <div className="flex flex-col gap-1">
      <dd className={clsx("m-0 type-stat", className ?? "text-text-1")}>
        {value}
      </dd>
      <dt className="type-meta text-text-2">
        {label}
        {detail && <span className="text-text-3">{` · ${detail}`}</span>}
      </dt>
    </div>
  );
}
