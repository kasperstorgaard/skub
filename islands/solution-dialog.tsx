import { type Signal } from "@preact/signals";
import clsx from "clsx/lite";
import { useMemo, useState } from "preact/hooks";

import { Icon, Spinner } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  isPreview?: boolean;
  savedName?: string | null;
};

export function SolutionDialog(
  { href, puzzle, isPreview, savedName }: Props,
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

  const isOpen = hasSolution && !savedName && !isPreview &&
    dialog !== "celebrate";

  return (
    <Dialog open={isOpen}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          Nice solve!
        </h2>

        <p>Pick a name to join the leaderboard.</p>
      </div>

      {!isPreview && (
        <form
          id="solution"
          className="flex flex-col gap-fl-2"
          action={puzzle.value.slug}
          method="post"
          onSubmit={() => setIsSubmitting(true)}
        >
          <label className="flex flex-col gap-1">
            <span className="text-text-2 text-1">Username</span>

            <input
              name="name"
              autocomplete="name"
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
          <input type="hidden" name="source" value="solution-dialog" />
        </form>
      )}

      {isPreview && (
        <p className="text-text-2">
          <em>Solutions cannot be submitted for previews</em>
        </p>
      )}

      <div className="flex gap-fl-2 justify-between flex-wrap w-full max-md:flex-col-reverse">
        <div
          className={clsx(
            "flex gap-fl-1 items-center text-text-2",
            "max-md:justify-center",
          )}
        >
          <a
            href={getResetHref(href.value)}
          >
            Try again
          </a>

          <form method="dialog" className="inline">
            <button
              type="submit"
              className="link p-0 bg-transparent"
              formNoValidate
              disabled={!hasSolution}
            >
              Close
            </button>
          </form>
        </div>

        {!isPreview && (
          <button
            form="solution"
            className="btn"
            type="submit"
            disabled={!hasSolution || isSubmitting}
          >
            {isSubmitting
              ? <Icon icon={Spinner} className="animate-spin" />
              : "Post your solve"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
