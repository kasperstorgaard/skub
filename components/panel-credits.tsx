import { clsx } from "clsx/lite";

import { GithubLogo, Icon, LinkedinLogo } from "#/components/icons.tsx";

type PanelCreditsProps = {
  className?: string;
};

/**
 * Mobile only: the credit, the profile links and the builder link at the foot
 * of a `Panel`. Desktop shows them in the sidebar itself.
 */
export function PanelCredits({ className }: PanelCreditsProps) {
  return (
    <div
      className={clsx(
        "lg:hidden col-[2/3] flex justify-between gap-fl-2",
        "type-meta text-text-2",
        className,
      )}
    >
      <p className="m-0">
        Inspired by <br />
        <a
          href="https://boardgamegeek.com/boardgame/51/ricochet-robots"
          className="text-2 text-text-1"
        >
          Ricochet Robots
        </a>
      </p>
      <div className="flex items-center gap-fl-2 text-5">
        <a
          href="https://github.com/kasperstorgaard/ricochet"
          className="flex text-text-2"
          aria-label="GitHub"
          title="GitHub"
        >
          <Icon icon={GithubLogo} />
        </a>
        <a
          href="https://www.linkedin.com/in/kasper-storgaard-t-lead"
          className="flex text-text-2"
          aria-label="LinkedIn"
          title="LinkedIn"
        >
          <Icon icon={LinkedinLogo} />
        </a>
      </div>
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
  );
}
