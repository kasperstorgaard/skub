import {
  Download,
  Icon,
  Pencil,
  Ranking,
  Trophy,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";

type ActionsPanelProps = {
  slug: string;
  /** The player has a star on the puzzle, which opens its solutions */
  hasStars?: boolean;
  showEdit?: boolean;
  isPreview?: boolean;
  /** Flash is on: its solves are off the leaderboard, so no link to it */
  isFlash?: boolean;
  className?: string;
};

/** The puzzle page's sidebar: the actions beside play. */
export function ActionsPanel(
  { slug, hasStars, showEdit, isPreview, isFlash, className }:
    ActionsPanelProps,
) {
  return (
    <Panel className={className}>
      <div className="flex justify-center lg:justify-start gap-fl-1 flex-wrap max-lg:col-[2/3] lg:grid lg:row-[3/4] lg:content-start lg:justify-items-start">
        {hasStars && !isPreview && !isFlash && (
          <a href={`/puzzles/${slug}/solutions`} className="btn">
            <Icon icon={Ranking} /> See solutions
          </a>
        )}

        {!isPreview && (
          <a href="/highscore" className="btn">
            <Icon icon={Trophy} /> High score
          </a>
        )}

        {isPreview && (
          <a href="/api/export" download className="btn">
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
            <button type="submit" className="btn">
              <Icon icon={Pencil} /> Edit
            </button>
          </form>
        )}
      </div>
    </Panel>
  );
}
