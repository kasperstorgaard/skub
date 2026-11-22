import { clsx } from "clsx/lite";

import { GithubLogo, Icon, LinkedinLogo } from "#/components/icons.tsx";

/**
 * Opposite the credits: the builder link, a feedback link (pages that pair it
 * with a `FeedbackDialog`) opening over `url`, or nothing, e.g. while building.
 */
export type PanelAsideProps =
  | { aside?: "builder" | "none"; url?: never }
  | { aside: "feedback"; url: URL };

type PanelCreditsProps = PanelAsideProps & { className?: string };

/**
 * The credit, GitHub and LinkedIn, and the builder or feedback link, on every
 * `Panel`.
 * Mobile: one row at the foot. Desktop: the row dissolves into the panel's
 * grid, the builder on top and the credits at the foot.
 */
export function PanelCredits(
  { aside = "builder", url, className }: PanelCreditsProps,
) {
  const feedbackUrl = url && new URL(url);
  feedbackUrl?.searchParams.set("dialog", "feedback");
  feedbackUrl?.searchParams.set("from", "panel");

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

      {aside === "builder" && (
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

      {feedbackUrl && (
        <p className="print:hidden m-0 text-right lg:text-left lg:row-start-1">
          Got thoughts? <br />
          <a
            href={feedbackUrl.href}
            // The dialog opens it on the current URL, see FeedbackDialog
            data-feedback
            className="text-2 text-text-1"
          >
            Send feedback
          </a>
        </p>
      )}
    </div>
  );
}
