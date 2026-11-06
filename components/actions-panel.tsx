import { clsx } from "clsx/lite";

import { Download, Icon, Pencil, Ranking, Star } from "#/components/icons.tsx";
import { PanelCredits } from "#/components/panel-credits.tsx";
import { PanelLinks } from "#/components/panel-links.tsx";
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
  return (
    <Panel className={clsx("max-lg:py-8", className)}>
      {/* Mobile: a dialog's actions row, two buttons sharing the width */}
      <div
        className={clsx(
          "max-lg:col-[2/3] grid gap-fl-1",
          "max-lg:grid-flow-col max-lg:auto-cols-fr",
          "lg:row-[3/4] lg:content-start lg:justify-items-start",
        )}
      >
        {!isPreview && !isFlash && (
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
        {isDev && !isPreview && (
          <a href={`/puzzles/${slug}/rate`} className="btn" data-secondary>
            <Icon icon={Star} /> Rate
          </a>
        )}
      </div>

      {/* The small print: credits and links as one group below the actions */}
      <PanelCredits className="mt-fl-4" />
      <PanelLinks className="col-[2/3] mt-fl-2" />
    </Panel>
  );
}
