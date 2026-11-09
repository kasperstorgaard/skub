import { clsx } from "clsx/lite";

import { PuzzleCard, PuzzleCardCaption } from "#/components/puzzle-card.tsx";
import { getPuzzleDate } from "#/game/date.ts";
import type { ArchiveDay } from "#/game/loader.ts";
import type { ScoreProgress } from "#/game/score.ts";

type ArchiveDaysProps = {
  days: ArchiveDay[];
  score: ScoreProgress;
};

/**
 * One grid item per day: its puzzle, or a muted stand-in. Also the API's
 * fragment, so the server renders every card.
 */
export function ArchiveDays({ days, score }: ArchiveDaysProps) {
  return (
    <>
      {days.map(({ number, puzzle }) => {
        const date = getPuzzleDate(number);
        const tagline = date.toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
        });

        return (
          <li
            key={number}
            id={date.toString()}
            data-number={number}
            data-month={getMonthLabel(date)}
            className="snap-start min-w-0 list-none pl-0"
          >
            {puzzle
              ? (
                <PuzzleCard
                  puzzle={puzzle}
                  score={score[puzzle.slug]}
                  tagline={tagline}
                />
              )
              : (
                <div className="flex flex-col gap-2 text-text-3">
                  <div className="aspect-square border-2 border-surface-3 rounded-1" />
                  <PuzzleCardCaption tagline={tagline}>
                    <span className="text-3">No puzzle</span>
                  </PuzzleCardCaption>
                </div>
              )}
          </li>
        );
      })}
    </>
  );
}

/** "November 2026": what the month label shows while a day is centred. */
export function getMonthLabel(date: Temporal.PlainDate) {
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

// A thumbnail outline over two caption bars, masked onto a token colour
const SKELETON_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" preserveAspectRatio="xMinYMin meet">` +
  `<rect x="1.5" y="1.5" width="97" height="97" rx="4" fill="none" stroke="black" stroke-width="3"/>` +
  `<rect x="0" y="106" width="36" height="6" rx="3"/>` +
  `<rect x="0" y="117" width="70" height="9" rx="4.5"/>` +
  `</svg>`;

type ArchiveSentinelProps = {
  side: "before" | "after";
  /** Days it stands in for. */
  span: number;
  /** The neighbouring week, for the link without JS. */
  href?: string;
};

/**
 * Stands in for the unloaded days on one side. Without JS, a prev/next link
 * one column wide; with JS, as wide as the days it covers, painted as
 * skeleton cards, and watched to load them.
 */
export function ArchiveSentinel({ side, span, href }: ArchiveSentinelProps) {
  return (
    <li
      data-sentinel={side}
      data-span={span}
      style={{ "--span": span }}
      aria-hidden={span === 0 || undefined}
      className={clsx(
        "relative list-none pl-0",
        "js:[grid-column:span_var(--span)]",
        "data-[span=0]:hidden",
      )}
    >
      {href && (
        <a
          href={href}
          className={clsx(
            "js:hidden",
            "grid place-content-center aspect-square text-2 text-link border-2 border-surface-3 rounded-1",
          )}
        >
          {side === "before" ? "Previous week" : "Next week"}
        </a>
      )}

      <div
        aria-hidden="true"
        style={{
          maskImage: `url("data:image/svg+xml,${
            encodeURIComponent(SKELETON_SVG)
          }")`,
        }}
        className={clsx(
          "hidden absolute inset-0",
          "js:block",
          "[mask-repeat:repeat-x] [mask-size:calc(var(--col)_+_var(--gap))_calc(var(--col)_*_1.3)]",
          "bg-surface-3",
        )}
      />
    </li>
  );
}
