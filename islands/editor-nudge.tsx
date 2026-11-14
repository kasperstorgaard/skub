import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";

import { Icon, PaperPlaneTilt } from "#/components/icons.tsx";
import type { SolveState } from "#/game/solver.ts";
import type { Puzzle } from "#/game/types.ts";
import { canSubmit } from "#/islands/submit-dialog.tsx";

type EditorNudgeProps = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  solveState: Signal<SolveState | undefined>;
  className?: string;
};

/** Under the toolbar: sending the puzzle in, enabled once the board solves. */
export function EditorNudge(
  { puzzle, href, solveState, className }: EditorNudgeProps,
) {
  const url = new URL(href.value);
  url.searchParams.set("submit", "compose");

  return (
    <aside
      className={clsx(
        "flex flex-col place-content-center gap-2 p-2 px-3",
        "text-text-2 text-pretty",
        className,
      )}
    >
      <p className="min-w-[16ch] text-center leading-snug">
        Happy with it?
      </p>

      {canSubmit(puzzle.value, solveState.value)
        ? (
          <a href={url.href} data-router className="btn">
            <Icon icon={PaperPlaneTilt} />
            Send it in
          </a>
        )
        : (
          <button type="button" disabled className="btn">
            <Icon icon={PaperPlaneTilt} />
            Send it in
          </button>
        )}
    </aside>
  );
}
