import { type Signal } from "@preact/signals";
import { useCallback, useMemo, useState } from "preact/hooks";

import { Check, Icon, Ranking, ShareNetwork } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { getShareText } from "#/game/share.ts";
import { getSolutionPercentile } from "#/game/stats.ts";
import { Puzzle, PuzzleStats } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  stats: PuzzleStats;
};

export function CelebrationDialog({ href, puzzle, stats }: Props) {
  const [copied, setCopied] = useState(false);

  const state = useMemo(() => decodeState(href.value), [href.value]);

  const dialog = useMemo(
    () => new URL(href.value).searchParams.get("dialog"),
    [href.value],
  );

  const moves = useMemo(
    () => state.moves.slice(0, state.cursor ?? state.moves.length),
    [state.moves, state.cursor],
  );

  const board = useMemo(() => resolveMoves(puzzle.value.board, moves), [
    puzzle.value.board,
    moves,
  ]);

  const hasSolution = useMemo(() => isValidSolution(board), [board]);
  const isOpen = hasSolution && dialog === "celebrate";

  const { solutionsHistogram, totalSolutions } = stats;

  // First-ever optimal: at most one solution at this move count (the user's own,
  // since stats may have been refreshed after the auto-post)
  const isFirstOptimal = moves.length === puzzle.value.minMoves &&
    (solutionsHistogram[moves.length] ?? 0) <= 1;

  const isOptimal = moves.length === puzzle.value.minMoves;

  const percentileRounded = totalSolutions >= 10
    ? Math.round((100 - getSolutionPercentile(stats, moves.length)) / 5) * 5
    : null;

  const onShare = useCallback(async () => {
    const origin = globalThis.location?.origin ?? "";
    const { text, url } = getShareText({
      origin,
      puzzle: puzzle.value,
      moveCount: moves.length,
      stats,
    });

    try {
      if ("share" in navigator) {
        // Pass url separately — apps append it themselves
        await globalThis.navigator.share({ text, url });
      } else {
        await globalThis.navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      // AbortError = user cancelled share sheet — ignore
      if (err instanceof Error && err.name !== "AbortError") {
        // Clipboard / share failed; fall back silently
        console.error("Share failed:", err);
      }
    }
  }, [puzzle.value, moves.length, stats]);

  return (
    <Dialog open={isOpen}>
      <div className="flex flex-col gap-fl-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          Solved in <span className="text-ui-2">{moves.length}</span> moves
        </h2>

        <div className="flex flex-col gap-1 text-3 text-text-2">
          {isFirstOptimal && <p>You found the first perfect solve!</p>}

          {!isFirstOptimal && isOptimal && totalSolutions >= 10 && (
            <p>Perfect — top {percentileRounded}%</p>
          )}

          {!isFirstOptimal && isOptimal && totalSolutions < 10 && (
            <p>Perfect solve!</p>
          )}

          {!isOptimal && totalSolutions >= 10 && <p>Top {percentileRounded}%
          </p>}

          <p>
            See how you compare, or share your solve.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-fl-1 items-stretch">
        <div className="flex gap-fl-1">
          <a
            href={`/puzzles/${puzzle.value.slug}/solutions`}
            className="btn flex-1 justify-center"
            data-primary
            autoFocus
          >
            <Icon icon={Ranking} /> See solves
          </a>

          <button
            type="button"
            className="btn flex-1 hidden js:inline-flex"
            onClick={onShare}
          >
            {copied
              ? (
                <>
                  <Icon icon={Check} /> Copied!
                </>
              )
              : (
                <>
                  <Icon icon={ShareNetwork} /> Share
                </>
              )}
          </button>
        </div>

        <div className="flex justify-center mt-1">
          <a href={getResetHref(href.value)} className="text-text-2 text-1">
            Start over
          </a>
        </div>
      </div>
    </Dialog>
  );
}
