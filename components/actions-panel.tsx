import { clsx } from "clsx/lite";

import { Download, Icon, Pencil, Ranking, Star } from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";

type ActionsPanelProps = {
  slug: string;
  isDev: boolean;
  showEdit?: boolean;
  isPreview?: boolean;
  /** Flash is on: its solves are off the leaderboard, so no link to it */
  isFlash?: boolean;
  className?: string;
};

/** The puzzle page's sidebar: the actions beside play. */
export function ActionsPanel(
  { slug, isDev, showEdit, isPreview, isFlash, className }: ActionsPanelProps,
) {
  const showSolves = !isPreview && !isFlash;
  const showRate = isDev && !isPreview;
  // Mobile shows a pair of actions or none: a lone button under the board
  // reads as a leftover. Desktop's sidebar always shows them.
  const isPair =
    [showSolves, isPreview, showEdit, showRate].filter(Boolean).length >= 2;

  return (
    <Panel className={clsx("max-lg:py-fl-5", className)}>
      {/* Mobile: a dialog's actions row, two buttons sharing the width */}
      <div
        className={clsx(
          "max-lg:col-[2/3] grid gap-fl-1",
          !isPair && "max-lg:hidden",
          "max-lg:grid-flow-col max-lg:auto-cols-fr",
          "lg:row-[3/4] lg:content-start lg:justify-items-start",
        )}
      >
        {showSolves && (
          <a
            href={`/puzzles/${slug}/solutions`}
            className="btn"
            data-secondary
          >
            <Icon icon={Ranking} /> See solves
          </a>
        )}

        {isPreview && (
          <a href="/api/export" download className="btn" data-secondary>
            <Icon icon={Download} />
            Download
          </a>
        )}

        {showEdit && (
          <form
            method="post"
            action={`/puzzles/${slug}/clone`}
            className="contents"
          >
            <button type="submit" className="btn" data-secondary>
              <Icon icon={Pencil} /> Edit
            </button>
          </form>
        )}

        {
          /* To the candidate it shipped from, not via clone: clone strips
            identity for remixing, and a rating filed under "Untitled, 0
            moves" is useless as ground truth. */
        }
        {showRate && (
          <a href={`/puzzles/${slug}/rate`} className="btn" data-secondary>
            <Icon icon={Star} /> Rate
          </a>
        )}
      </div>
    </Panel>
  );
}
