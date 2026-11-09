import { clsx } from "clsx/lite";
import { AnchorHTMLAttributes } from "preact";

import { Icon, Play } from "#/components/icons.tsx";
import { Stars } from "#/components/stars.tsx";
import { Thumbnail } from "#/components/thumbnail.tsx";
import type { ScoreKind } from "#/game/score.ts";
import type { Puzzle } from "#/game/types.ts";

export type PuzzleCardProps =
  & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children">
  & {
    puzzle: Puzzle;
    /** The player's solution score on the puzzle, in display order. */
    score?: ScoreKind[];
    tagline?: string;
    showPlay?: boolean;
    /** `lg` for a card standing on its own, e.g. the calendar's selected day. */
    size?: "md" | "lg";
  };

/**
 * Canonical clickable puzzle card,
 * showing an svg of the puzzle, and letting the consumer pass the
 *
 * Once solved: the earned stars in the top right.
 *
 * Pass `children` for a rich tagline or `tagline` for a plain string.
 */
export function PuzzleCard({
  puzzle,
  score = [],
  tagline,
  showPlay,
  size = "md",
  className,
  ...rest
}: PuzzleCardProps) {
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

        <Stars
          kinds={score}
          className={clsx(
            "absolute top-0 right-0 p-2 py-2.5",
            size === "lg" ? "text-5" : "text-4",
          )}
        />
      </div>

      {/* The number joins the lead, so the name stands alone */}
      <PuzzleCardCaption
        tagline={[tagline, puzzle.number && `#${puzzle.number}`]
          .filter(Boolean)
          .join(" ")}
        size={size}
      >
        <span
          className={size === "lg"
            ? "text-5 font-3 leading-flat"
            : "type-title"}
        >
          {puzzle.name}
        </span>
      </PuzzleCardCaption>
    </a>
  );
}

type PuzzleCardCaptionProps = {
  tagline?: string;
  size?: "md" | "lg";
  children: preact.ComponentChildren;
};

/** The lead and title under a card's thumbnail. */
export function PuzzleCardCaption(
  { tagline, size = "md", children }: PuzzleCardCaptionProps,
) {
  return (
    <div className="flex flex-col">
      {tagline && (
        <span
          className={clsx(
            "puzzle-card-tagline [font-weight:300] leading-tight text-text-2",
            size === "lg" ? "text-3" : "type-meta",
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
