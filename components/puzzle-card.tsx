import { clsx } from "clsx/lite";
import { AnchorHTMLAttributes } from "preact";

import { Check, Icon, Play, Trophy } from "#/components/icons.tsx";
import { Thumbnail } from "#/components/thumbnail.tsx";
import type { Puzzle } from "#/game/types.ts";

export type PuzzleCardProps =
  & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">
  & {
    puzzle: Puzzle;
    bestMoves?: number;
    tagline?: string;
    showPlay?: boolean;
  };

/**
 * Canonical clickable puzzle card,
 * showing an svg of the puzzle, and letting the consumer pass the
 *
 * States:
 *   - solved (bestMoves > minMoves): ph-check icon + move count
 *   - optimal (bestMoves === minMoves): ph-trophy icon + move count
 *
 * Pass `children` for a rich tagline or `tagline` for a plain string.
 */
export function PuzzleCard({
  puzzle,
  bestMoves,
  tagline,
  showPlay,
  className,
  ...rest
}: PuzzleCardProps) {
  const isOptimal = bestMoves !== undefined &&
    puzzle.minMoves !== undefined &&
    bestMoves === puzzle.minMoves;
  const isSolved = bestMoves !== undefined;

  return (
    <a
      href={`/puzzles/${puzzle.slug}`}
      class={clsx(
        "puzzle-card group flex flex-col gap-2 text-text-1 no-underline",
        className,
      )}
      {...rest}
    >
      <div
        class={clsx(
          "puzzle-card-thumb relative flex border-2 border-link rounded-1",
          "group-hover:filter-[lighten(1.3)] transition-colors",
        )}
      >
        <Thumbnail
          board={puzzle.board}
          className="basis-0 grow aspect-square h-full"
        />

        {showPlay && (
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Icon
              icon={Play}
              className="text-[4rem] lg:text-[5rem] text-link opacity-50 group-hover:opacity-90 transition-opacity"
            />
          </div>
        )}

        {isSolved && (
          <div
            class={clsx(
              "absolute top-0 right-0 p-2 py-2.5",
              "grid grid-flow-col gap-1 place-content-center",
            )}
          >
            <span
              class={clsx(
                "flex items-center justify-center gap-1 p-0.5 border-1 rounded-2 aspect-square",
                "text-surface-1 leading-tight text-3 text-center",
                isOptimal ? "bg-ui-2 border-ui-2" : "bg-ui-1 border-ui-1",
              )}
            >
              <Icon
                icon={isOptimal ? Trophy : Check}
                aria-label={isOptimal ? "Perfect" : "Solved"}
              />
            </span>
            <span
              class={clsx(
                "flex items-center justify-center gap-1 p-0.5 border-text-1 border-1 rounded-2 aspect-square",
                "tracking-wide leading-tight text-3 font-medium bg-text-1 text-surface-1",
              )}
            >
              {bestMoves}
            </span>
          </div>
        )}
      </div>

      {/* The number joins the lead, so the name stands alone */}
      <PuzzleCardCaption
        tagline={[tagline, puzzle.number && `#${puzzle.number}`]
          .filter(Boolean)
          .join(" ")}
      >
        <span className="type-title">{puzzle.name}</span>
      </PuzzleCardCaption>
    </a>
  );
}

type PuzzleCardCaptionProps = {
  tagline?: string;
  children: preact.ComponentChildren;
};

/** The lead and title under a card's thumbnail. */
export function PuzzleCardCaption(
  { tagline, children }: PuzzleCardCaptionProps,
) {
  return (
    <div className="flex flex-col">
      {tagline && (
        <span
          className={clsx(
            "puzzle-card-tagline type-meta font-3 leading-tight text-text-2",
            "group-hover:text-current",
          )}
        >
          {tagline}
        </span>
      )}
      {children}
    </div>
  );
}
