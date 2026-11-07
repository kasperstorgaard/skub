import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useState } from "preact/hooks";

import { DialogActions, DISMISS } from "#/components/dialog-actions.tsx";
import { ArrowRight, Icon, Ranking } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import {
  type CelebrationType,
  countSolvesAbove,
  getCelebrationType,
} from "#/game/celebration.ts";
import { defaultPuzzleStats } from "#/game/stats.ts";
import { Puzzle, PuzzleStats } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { getBoardRippleDuration } from "#/lib/board-ripple.ts";

export type CelebrationData = {
  isNewPath: boolean;
  puzzleStats: PuzzleStats;
  /** Flash solves of this puzzle, this one included, for a Flash solve. */
  flashSolves?: number;
};

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  back: { href: string; label: string };
  celebrationData: Signal<CelebrationData | null>;
  celebrationError: Signal<boolean>;
  /** A Flash solve: compared with other Flash solves, not the leaderboard. */
  isFlash?: boolean;
};

export function CelebrationDialog(
  {
    href,
    puzzle,
    back,
    celebrationData,
    celebrationError,
    isFlash,
  }: Props,
) {
  const destination = puzzle.value.board.destination;
  const rippleDuration = useMemo(
    () => destination ? getBoardRippleDuration(destination) : 0,
    [destination?.x, destination?.y],
  );
  const [minElapsed, setMinElapsed] = useState(false);

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

  // Gives way to any dialog named in the URL: one dialog at a time.
  const isOpen = hasSolution && minElapsed && !dialog;

  // Wait for the board ripple transition before opening. Resets when the
  // user undoes back across the solve.
  useEffect(() => {
    if (!hasSolution) {
      setMinElapsed(false);
      return;
    }
    const timer = setTimeout(() => setMinElapsed(true), rippleDuration);
    return () => clearTimeout(timer);
  }, [hasSolution, rippleDuration]);

  const data = celebrationData.value;
  const isError = celebrationError.value;
  const isLoading = isOpen && !data && !isError;

  const puzzleStats = data?.puzzleStats ?? defaultPuzzleStats;
  const isNewPath = data?.isNewPath ?? false;

  const isPerfect = moves.length === puzzle.value.minMoves;
  const isGreat = moves.length <= puzzle.value.minMoves + 2;

  const headline = isPerfect
    ? `Perfect — ${moves.length} moves!`
    : isGreat
    ? `Great — ${moves.length} moves!`
    : `Solved — ${moves.length} moves`;

  const body = useMemo(
    () => {
      if (isFlash) return getFlashMessage(data?.flashSolves ?? 1);
      const type = getCelebrationType(moves.length, puzzle.value, {
        puzzleStats,
        isNewPath,
      });
      return getMessage(type, moves.length, puzzleStats);
    },
    [moves.length, puzzle.value, puzzleStats, isNewPath, isFlash, data],
  );

  return (
    <Dialog open={isOpen} className="w-full">
      <div className="flex flex-col gap-fl-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          {headline}
        </h2>

        {isLoading
          ? (
            <p className="text-3 text-text-2">
              Calculating stats<span className="loading-dots ml-[0.2ch]">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          )
          : (
            <p className="text-3 text-text-2">
              {isError ? "Couldn't load stats." : body}
            </p>
          )}
      </div>

      <DialogActions
        // One way out: another go if it wasn't perfect, otherwise back
        dismiss={isPerfect
          ? (
            <a href={back.href} className={DISMISS}>
              {back.label}
            </a>
          )
          : (
            <a href={getResetHref(href.value)} className={DISMISS}>
              Try again
            </a>
          )}
      >
        {
          // Flash solves are compared above, not on the leaderboard
          !isFlash && (
            <a href={`/puzzles/${puzzle.value.slug}/solutions`} className="btn">
              <Icon icon={Ranking} /> See solutions
            </a>
          )
        }

        <a
          href="/puzzles/recommended"
          className="btn"
          autoFocus
        >
          Play one more <Icon icon={ArrowRight} />
        </a>
      </DialogActions>
    </Dialog>
  );
}

/** The stats line for a Flash solve, against the other Flash solves. */
function getFlashMessage(flashSolves: number): string {
  const count = flashSolves - 1;

  if (count === 0) {
    return pickRandom([
      "First to solve it with Flash",
      "First Flash solve so far",
      "No one else has solved it with Flash yet",
    ]);
  }

  return pickRandom([
    `Joined ${count} ${count === 1 ? "other" : "others"}`,
    `${count} other Flash ${count === 1 ? "solve" : "solves"} so far`,
    `${count} ${
      count === 1 ? "other has" : "others have"
    } solved it with Flash`,
  ]);
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Maps a celebration type to a randomly-picked body string. Each case has
 * 3 wording variants. The headline carries closeness (Perfect / Great /
 * Solved) — bodies are factual fragments, no praise word stacking.
 */
function getMessage(
  type: CelebrationType,
  moveCount: number,
  puzzleStats: PuzzleStats,
): string {
  const { totalSolutions, solutionsHistogram } = puzzleStats;

  switch (type) {
    case "champion":
      return pickRandom([
        "First to nail it",
        "First perfect solve so far",
        "No one else has hit it yet",
      ]);
    case "perfectionist": {
      const perfectsCount = solutionsHistogram[moveCount] ?? 0;
      const pct = Math.max(
        1,
        Math.round((perfectsCount / totalSolutions) * 100),
      );
      return pickRandom([
        `Top ${pct}% of solves`,
        `In the top ${pct}% of solves`,
        `${pct}% of solves match this`,
      ]);
    }
    case "pioneer":
      return pickRandom([
        "First solve in the books",
        "First to crack this puzzle",
        "Only solver so far",
      ]);
    case "creative":
      return pickRandom([
        "First to get this solution",
        "No one has solved it this way before",
        "A creative path",
      ]);
    case "adept": {
      const pct = Math.round(
        (countSolvesAbove(solutionsHistogram, moveCount) / totalSolutions) *
          100,
      );
      return pickRandom([
        `Better than ${pct}% of solves`,
        `${pct}% of solves were slower`,
        `Beat ${pct}% of solves`,
      ]);
    }
    case "fallback": {
      const count = totalSolutions - 1;
      return pickRandom([
        `Joined ${count} ${count === 1 ? "other" : "others"}`,
        `${count} other ${count === 1 ? "solve" : "solves"} so far`,
        `${count} ${count === 1 ? "other has" : "others have"} solved this`,
      ]);
    }
  }
}
