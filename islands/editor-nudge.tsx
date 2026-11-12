import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { Eye, Icon, PaperPlaneTilt } from "#/components/icons.tsx";
import type { SolveState } from "#/game/solver.ts";
import type { Puzzle } from "#/game/types.ts";
import { canSubmit } from "#/islands/submit-dialog.tsx";

type EditorNudgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  solveState: Signal<SolveState | undefined>;
  /** Submissions are on: preview leads on to sending it in */
  canSend?: boolean;
  className?: string;
};

/**
 * Under the toolbar, once the board has a solution: the next steps after
 * building, preview then send it in.
 */
export function EditorNudge(
  { puzzle, href, solveState, canSend, className }: EditorNudgeProps,
) {
  if (!canSubmit(puzzle.value, solveState.value)) return null;

  const url = new URL(href.value);
  url.searchParams.set("submit", "compose");

  return (
    <aside
      className={clsx(
        "flex flex-col place-content-center gap-2 p-2 px-3",
        "text-text-2 text-pretty",
        "animate-fade-in",
        className,
      )}
    >
      <p className="min-w-[16ch] text-center leading-snug">
        Happy with it?
      </p>

      <div className="flex flex-wrap justify-center gap-2">
        {/* Its own tab: the build stays put */}
        <a href="/puzzles/preview" target="_blank" className="btn">
          <Icon icon={Eye} />
          Preview
        </a>

        {canSend && (
          <a href={url.href} data-router className="btn">
            <Icon icon={PaperPlaneTilt} />
            Send it in
          </a>
        )}
      </div>
    </aside>
  );
}
