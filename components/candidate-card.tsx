import { clsx } from "clsx/lite";

import { Icon, RocketLaunch, StarFill } from "#/components/icons.tsx";
import { Thumbnail } from "#/components/thumbnail.tsx";
import type { Board } from "#/game/types.ts";

type CandidateCardProps = {
  /** The version the card opens: the family's newest. */
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
 * One board family in the candidate list: the newest version's thumbnail, the
 * best rating any version earned, and whether one shipped.
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
  return (
    <a
      href={`/candidates/${slug}`}
      className={clsx(
        "group flex flex-col gap-1 text-text-1 no-underline",
        className,
      )}
    >
      <div className="flex border-2 border-link rounded-1 group-hover:filter-[lighten(1.3)] transition-colors">
        <Thumbnail board={board} className="basis-0 grow aspect-square" />
      </div>

      <span className="flex justify-between items-baseline gap-1">
        <span className="text-3 font-semibold leading-flat">{label}</span>
        {bestRating !== undefined && (
          <span className="flex items-center gap-0.5 text-1 text-text-2 tabular-nums">
            <Icon icon={StarFill} className="text-brand" />
            {bestRating}
          </span>
        )}
      </span>

      <span className="flex flex-wrap gap-x-fl-1 text-1 text-text-2 leading-tight">
        {versions > 1 && <span>{versions} versions</span>}
        {corpus && <span>corpus</span>}
        {promotedAs && (
          <span className="flex items-center gap-0.5 text-text-1">
            <Icon icon={RocketLaunch} /> {promotedAs}
          </span>
        )}
      </span>
    </a>
  );
}
