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
  return (
    <Panel className={className}>
      <div className="flex justify-center lg:justify-start gap-fl-1 flex-wrap max-lg:col-[2/3] lg:grid lg:row-[3/4] lg:content-start lg:justify-items-start">
        {!isPreview && !isFlash && (
          <a href={`/puzzles/${slug}/solutions`} className="btn">
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

      {/* Mobile only, like home's footer; desktop has these in the sidebar */}
      <div className="lg:hidden col-[2/3] mt-fl-4 flex justify-between gap-fl-2 type-meta text-text-2">
        <p className="m-0">
          Inspired by <br />
          <a
            href="https://boardgamegeek.com/boardgame/51/ricochet-robots"
            className="text-2 text-text-1"
          >
            Ricochet Robots
          </a>
        </p>
        <p className="m-0 text-right">
          Feeling creative? <br />
          <a
            href="/puzzles/new"
            // Full navigation: /puzzles/new redirects, which client nav drops
            f-client-nav={false}
            className="text-2 text-text-1"
          >
            Build a puzzle
          </a>
        </p>
      </div>
    </Panel>
  );
}
