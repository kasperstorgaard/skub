import type { Signal } from "@preact/signals";
import { useCallback, useMemo } from "preact/hooks";

import type { SolveState } from "#/components/difficulty-badge.tsx";
import { Icon, PaperPlaneTilt } from "#/components/icons.tsx";
import { formatPuzzle } from "#/game/formatter.ts";
import type { Puzzle } from "#/game/types.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  puzzle: Signal<Puzzle>;
  href: Signal<string>;
  solveState: Signal<SolveState | undefined>;
  // The logged-in player's address, used as Reply-To on submissions.
  userEmail?: string;
};

/**
 * The editor's submit flow, driven by `?submit=`: `compose` asks for an
 * optional note before sending, `sent`/`failed` is the action's answer.
 */
export function SubmitDialog({ puzzle, href, solveState, userEmail }: Props) {
  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  useRouter({ onLocationUpdated });

  const step = useMemo(
    () => new URL(href.value).searchParams.get("submit"),
    [href.value],
  );

  const closeHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.delete("submit");
    return url.href;
  }, [href.value]);

  if (step === "sent" || step === "failed") {
    return (
      <Dialog open>
        <div className="flex flex-col gap-fl-2 text-text-2">
          <h2 className="text-fl-2 font-semibold text-text-1">
            {step === "sent" ? "Puzzle submitted" : "Puzzle not submitted"}
          </h2>

          <p>
            {step === "sent"
              ? "Nice! It's in my inbox. I'll take a look soon, and hopefully you'll see it in the game."
              : "The email didn't go through. Try again."}
          </p>
        </div>

        <a href={closeHref} data-router="replace" className="btn self-center">
          Back to editor
        </a>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={step === "compose" && canSubmit(puzzle.value, solveState.value)}
    >
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          Submit a puzzle
        </h2>

        <p>
          I play every puzzle and do my best to reply to everyone.
          <br />
          If yours makes it into Skub, I'll keep the name you gave it (ideally a
          real person's name rather than a username).
        </p>
      </div>

      <form
        id="submit"
        action="/puzzles/build/submit"
        method="post"
        className="flex flex-col gap-fl-2"
      >
        <input
          type="hidden"
          name="markdown"
          value={formatPuzzle(puzzle.value)}
        />

        <label className="flex flex-col gap-1">
          <span className="text-text-2 text-1">Note (optional)</span>
          <textarea
            name="note"
            rows={3}
            maxLength={2000}
            className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
          />
        </label>

        {userEmail
          ? (
            <label className="flex items-center gap-1 text-text-2 text-1">
              <input type="checkbox" name="include_email" defaultChecked />
              Include my email ({userEmail})
            </label>
          )
          : (
            <label className="flex flex-col gap-1">
              <span className="text-text-2 text-1">
                Email (optional, so I can reply)
              </span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
              />
            </label>
          )}
      </form>

      <div className="flex gap-fl-2 justify-between flex-wrap w-full max-md:flex-col-reverse">
        <a
          href={closeHref}
          data-router="replace"
          className="flex items-center text-text-2 max-md:justify-center"
        >
          Cancel
        </a>

        <button form="submit" type="submit" className="btn">
          <Icon icon={PaperPlaneTilt} /> Send
        </button>
      </div>
    </Dialog>
  );
}

/**
 * Whether the board can be submitted: once the editor's solve has found a
 * solution, or has given up on its budget — a busy board goes through unconfirmed.
 */
export function canSubmit(puzzle: Puzzle, solveState?: SolveState) {
  if (puzzle.minMoves) return true;

  return solveState?.type === "error" && solveState.reason === "budget";
}
