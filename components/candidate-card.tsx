import { clsx } from "clsx/lite";

import { Icon, RocketLaunch, StarFill } from "#/components/icons.tsx";
import { Thumbnail } from "#/components/thumbnail.tsx";
import type { Board } from "#/game/types.ts";

type CandidateCardProps = {
  /** The version the card opens: the one that shipped, else the newest. */
  slug: string;
  label: string;
  board: Board;
  versions: number;
  bestRating?: number;
  promotedAs?: string;
  corpus: boolean;
  className?: string;
};

/**
 * One board family in the candidate list, styled after `PuzzleCard`: the
 * promoted version's thumbnail (the newest's if none shipped), the best rating
 * any version earned, and — where the puzzle card shows difficulty — the slug
 * it shipped as.
 */
export function CandidateCard(
  {
    slug,
    label,
    board,
    versions,
    bestRating,
    promotedAs,
    corpus,
    className,
  }: CandidateCardProps,
) {
  const details = [
    versions > 1 && `${versions} versions`,
    corpus && "corpus",
  ].filter(Boolean).join(" · ");

  return (
    <a
      href={`/candidates/${slug}`}
      className={clsx(
        "puzzle-card group flex flex-col gap-1 text-text-1 no-underline",
        className,
      )}
    >
      <div
        className={clsx(
          "puzzle-card-thumb relative flex border-2 border-link rounded-1",
          "group-hover:filter-[lighten(1.3)] transition-colors",
        )}
      >
        <Thumbnail
          board={board}
          className="basis-0 grow aspect-square h-full"
        />

        {promotedAs && (
          <div
            className={clsx(
              "puzzle-card-difficulty absolute bottom-0 right-0 px-3 bg-surface-2",
              "flex items-center gap-1 text-current leading-relaxed text-1 uppercase tracking-wider",
              "[clip-path:polygon(10%_0,100%_0,100%_100%,0_100%)]",
            )}
          >
            <Icon icon={RocketLaunch} aria-label="Promoted as" />
            {promotedAs}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span
          className={clsx(
            "puzzle-card-tagline flex gap-1 text-1 text-text-2 tracking-wide leading-tight",
            "group-hover:text-current",
          )}
        >
          {bestRating !== undefined && (
            <span className="flex items-center gap-0.5 tabular-nums">
              <Icon icon={StarFill} className="text-brand" />
              {bestRating}
            </span>
          )}
          {bestRating !== undefined && details && <span>·</span>}
          {details && <span>{details}</span>}
        </span>

        <span className="text-4 font-semibold leading-flat">{label}</span>
      </div>
    </a>
  );
}
