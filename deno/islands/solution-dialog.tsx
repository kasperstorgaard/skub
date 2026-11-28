import { type Signal } from "@preact/signals";
import { IS_BROWSER } from "fresh/runtime";
import { useEffect, useMemo, useState } from "preact/hooks";

import { DialogActions, DISMISS } from "#/components/dialog-actions.tsx";
import { Icon, Spinner } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  savedName?: string | null;
  /** Where "Not now" goes: the page's back link */
  backHref: string;
};

export function SolutionDialog(
  { href, puzzle, savedName, backHref }: Props,
) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateLocation } = useRouter();

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

  // With JS, a named player's solve saves itself: no form needed.
  const isSelfSaving = IS_BROWSER && !!savedName;

  // Opens on the JS path (anonymous user solves in browser) or the no-JS path
  // (server detects solve and redirects here with dialog=solution). Gives way
  // to any other dialog named in the URL.
  const isOpen = (dialog === "solution" && !isSelfSaving) ||
    (!dialog && hasSolution && !savedName);

  // A reload of a solve lands on the no-JS redirect: hand over to auto-post.
  useEffect(() => {
    if (dialog !== "solution" || !isSelfSaving) return;
    const url = new URL(href.value);
    url.searchParams.delete("dialog");
    updateLocation(url.href, { replace: true });
  }, [dialog, isSelfSaving]);

  return (
    <Dialog open={isOpen}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          Solved!
        </h2>

        {/* Filled in already: the name speaks for itself */}
        {!savedName && (
          <p>Pick a good name. Other players see it next to your solutions.</p>
        )}
      </div>

      <form
        id="solution"
        className="flex flex-col gap-fl-2"
        action={`/puzzles/${puzzle.value.slug}`}
        method="post"
        onSubmit={() => setIsSubmitting(true)}
      >
        <label className="flex flex-col">
          <span className="sr-only">Username</span>

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

      <DialogActions
        dismiss={
          <a href={backHref} className={DISMISS}>
            Not now
          </a>
        }
      >
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
      </DialogActions>
    </Dialog>
  );
}
