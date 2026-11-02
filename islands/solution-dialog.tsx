import { type Signal } from "@preact/signals";
import clsx from "clsx/lite";
import { useMemo, useState } from "preact/hooks";

import { ArrowRight, Icon, Spinner } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import type { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  savedName?: string | null;
  /** Flash is on: the solve stays off the leaderboard, so no name. */
  isFlash?: boolean;
};

export function SolutionDialog(
  { href, puzzle, savedName, isFlash }: Props,
) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const state = useMemo(() => decodeState(href.value), [href.value]);

  const moves = useMemo(
    () => state.moves.slice(0, state.cursor ?? state.moves.length),
    [state.moves, state.cursor],
  );

  const board = useMemo(() => resolveMoves(puzzle.value.board, moves), [
    puzzle.value.board,
    moves,
  ]);

  const hasSolution = useMemo(() => isValidSolution(board), [board]);

  const dialog = useMemo(
    () => new URL(href.value).searchParams.get("dialog"),
    [href.value],
  );

  // Opens on the JS path (anonymous user solves in browser) or the no-JS path
  // (server detects solve and redirects here with dialog=solution).
  const isOpen = dialog === "solution" ||
    (hasSolution && !savedName && !isFlash);

  // Without JS only; with it, a Flash solve gets the celebration.
  if (isFlash) {
    return (
      <Dialog open={isOpen}>
        <div className="flex flex-col gap-fl-2 text-text-2">
          <h2 className="text-fl-2 font-semibold text-text-1">
            Solved — {moves.length} moves
          </h2>

          <p>Flash solves stay off the leaderboard.</p>
        </div>

        {/* Saves the solve to your progress on the way, for when JS is off. */}
        <form
          action={`/puzzles/${puzzle.value.slug}`}
          method="post"
          className="flex justify-end"
          onSubmit={() => setIsSubmitting(true)}
        >
          <input type="hidden" name="moves" value={JSON.stringify(moves)} />

          <button
            type="submit"
            className="btn"
            disabled={!hasSolution || isSubmitting}
          >
            {isSubmitting
              ? <Icon icon={Spinner} className="animate-spin" />
              : <Icon icon={ArrowRight} />}
            One more
          </button>
        </form>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          Nice solve!
        </h2>

        <p>
          {savedName
            ? "Get your solve on the board."
            : "Pick a name and get your solve on the board."}
        </p>
      </div>

      <form
        id="solution"
        className="flex flex-col gap-fl-2"
        action={`/puzzles/${puzzle.value.slug}`}
        method="post"
        onSubmit={() => setIsSubmitting(true)}
      >
        <label className="flex flex-col gap-1">
          <span className="text-text-2 text-1">Username</span>

          <input
            name="name"
            autocomplete="username"
            placeholder="fx. Jungleboi87"
            value={savedName ?? undefined}
            required
            className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
          />
        </label>

        <input
          type="hidden"
          name="moves"
          value={JSON.stringify(state.moves)}
        />
      </form>

      <div className="flex gap-fl-2 justify-between flex-wrap w-full max-md:flex-col-reverse">
        <div
          className={clsx(
            "flex gap-fl-1 items-center text-text-2",
            "max-md:justify-center",
          )}
        >
          <a href="/puzzles/recommended">
            One more
          </a>
        </div>

        <button
          form="solution"
          className="btn"
          type="submit"
          disabled={!hasSolution || isSubmitting}
        >
          {isSubmitting
            ? <Icon icon={Spinner} className="animate-spin" />
            : "Save"}
        </button>
      </div>
    </Dialog>
  );
}
