import { Download, Icon, Pencil, Ranking, Star } from "#/components/icons.tsx";
import { PanelCredits } from "#/components/panel-credits.tsx";
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
    <Panel className={className}>
      <div className="flex justify-center lg:justify-start gap-fl-1 flex-wrap max-lg:col-[2/3] lg:grid lg:row-[3/4] lg:content-start lg:justify-items-start">
        {!isPreview && !isFlash && (
          <a
            href={`/puzzles/${slug}/solutions`}
            className="btn min-w-(--size-content-1)"
          >
            <Icon icon={Ranking} /> See solves
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

        {
          /* To the candidate it shipped from, not via clone: clone strips
            identity for remixing, and a rating filed under "Untitled, 0
            moves" is useless as ground truth. */
        }
        {isDev && !isPreview && (
          <a href={`/puzzles/${slug}/rate`} className="btn">
            <Icon icon={Star} /> Rate
          </a>
        )}
      </div>

      <PanelCredits className="mt-fl-4" />
    </Panel>
  );
}
