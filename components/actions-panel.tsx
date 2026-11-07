import { Download, Icon, Pencil, Ranking } from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";

type ActionsPanelProps = {
  slug: string;
  showEdit?: boolean;
  isPreview?: boolean;
  /** The player has solved the puzzle: the only way in to its solutions */
  hasSolved?: boolean;
  /** Flash is on: its solutions are their own tab */
  isFlash?: boolean;
  className?: string;
};

/** The puzzle page's sidebar: the actions beside play. */
export function ActionsPanel(
  { slug, hasSolved, showEdit, isPreview, isFlash, className }:
    ActionsPanelProps,
) {
  return (
    <Panel className={className}>
      <div className="flex justify-center lg:justify-start gap-fl-1 flex-wrap max-lg:col-[2/3] lg:grid lg:row-[3/4] lg:content-start lg:justify-items-start">
        {hasSolved && !isPreview && (
          <a
            href={`/puzzles/${slug}/solutions${isFlash ? "?tab=flash" : ""}`}
            className="btn"
          >
            <Icon icon={Ranking} /> See solutions
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
