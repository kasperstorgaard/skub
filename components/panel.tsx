import { clsx } from "clsx/lite";

import { GithubLogo, Icon, LinkedinLogo } from "#/components/icons.tsx";

type PanelProps = preact.HTMLAttributes<HTMLElement>;

/**
 * Shared panel component for sidebars
 * - Mobile/tablet: Bottom panel spanning full width
 * - Large screens: Fixed right sidebar
 */
export function Panel({ children, className }: PanelProps) {
  return (
    <aside
      className={clsx(
        "panel col-span-3 grid grid-cols-subgrid place-content-start",
        "border-t border-brand bg-panel py-fl-4",
        "max-md:text-fl-1",
        "lg:col-start-2 lg:col-span-1 lg:grid-rows-subgrid lg:row-span-full lg:px-fl-2",
        className,
      )}
    >
      {children}

      {/* Desktop only, on every page: the builder on top, credits at the foot */}
      <p className="max-lg:hidden print:hidden row-start-1 m-0 type-meta text-text-2">
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

      <footer className="max-lg:hidden print:hidden row-start-4 self-end flex flex-col gap-fl-2 type-meta text-text-2">
        <p className="m-0">
          Inspired by <br />
          <a
            href="https://boardgamegeek.com/boardgame/51/ricochet-robots"
            className="text-2 text-text-1"
          >
            Ricochet Robots
          </a>
        </p>

        <div className="flex flex-col gap-2 text-2">
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
    </aside>
  );
}
