import { clsx } from "clsx/lite";

import { GithubLogo, Icon, LinkedinLogo } from "#/components/icons.tsx";

type PanelCreditsProps = {
  /** Drop the builder link, e.g. while building */
  hideBuilder?: boolean;
  className?: string;
};

/**
 * The credit, GitHub and LinkedIn, and the builder link, on every `Panel`.
 * Mobile: one row at the foot. Desktop: the row dissolves into the panel's
 * grid, the builder on top and the credits at the foot.
 */
export function PanelCredits({ hideBuilder, className }: PanelCreditsProps) {
  return (
    <div
      className={clsx(
        "print:hidden col-[2/3] flex justify-between gap-fl-2 lg:contents",
        "type-meta text-text-2",
        className,
      )}
    >
      {/* print:hidden on each part too: on desktop the row is display: contents */}
      <footer className="print:hidden flex flex-col gap-fl-3 lg:gap-fl-2 lg:row-start-4 lg:self-end">
        <p className="m-0">
          Inspired by <br />
          <a
            href="https://boardgamegeek.com/boardgame/51/ricochet-robots"
            className="text-2 text-text-1"
          >
            Ricochet Robots
          </a>
        </p>

        <div className="flex gap-2 lg:flex-col text-2">
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
      </footer>

      {!hideBuilder && (
        <p className="print:hidden m-0 text-right lg:text-left lg:row-start-1">
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
