import { clsx } from "clsx/lite";

import { GithubLogo, Icon, LinkedinLogo } from "#/components/icons.tsx";

type PanelCreditsProps = {
  /** Drop the builder link, e.g. while building */
  hideBuilder?: boolean;
  className?: string;
};

/**
 * Mobile only: the credit, GitHub and LinkedIn, and the builder link at the foot
 * of a `Panel`. Desktop shows them in the sidebar itself.
 */
export function PanelCredits({ hideBuilder, className }: PanelCreditsProps) {
  return (
    <div
      className={clsx(
        "lg:hidden print:hidden col-[2/3] flex justify-between gap-fl-2",
        "type-meta text-text-2",
        className,
      )}
    >
      <div className="flex flex-col gap-fl-2">
        <p className="m-0">
          Inspired by <br />
          <a
            href="https://boardgamegeek.com/boardgame/51/ricochet-robots"
            className="text-2 text-text-1"
          >
            Ricochet Robots
          </a>
        </p>

        <div className="flex gap-2 text-2">
          <a
            href="https://github.com/kasperstorgaard/ricochet"
            className="flex gap-1 text-text-2"
          >
            <Icon icon={GithubLogo} />GitHub
          </a>
          <a
            href="https://www.linkedin.com/in/kasper-storgaard-t-lead"
            className="flex gap-1 text-text-2"
          >
            <Icon icon={LinkedinLogo} />LinkedIn
          </a>
        </div>
      </div>
      {!hideBuilder && (
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
      )}
    </div>
  );
}
