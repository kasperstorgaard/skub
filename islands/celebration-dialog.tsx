import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useState } from "preact/hooks";

import { ArrowRight, Icon, Ranking } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { defaultPuzzleStats } from "#/game/stats.ts";
import { UserStats } from "#/game/streak.ts";
import { Puzzle, PuzzleStats } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { getBoardRippleDuration } from "#/lib/board-ripple.ts";

export type CelebrationData = {
  isNewPath: boolean;
  puzzleStats: PuzzleStats;
  userStats: UserStats | null;
};

type CelebrationCase =
  | "first-solver"
  | "first-optimal"
  | "new-path"
  | "streak-milestone"
  | "streak"
  | "other-solvers";

type CelebrationContent = {
  case: CelebrationCase;
  body: string;
};

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  back: { href: string; label: string };
  celebrationData: Signal<CelebrationData | null>;
  celebrationError: Signal<boolean>;
};

export function CelebrationDialog(
  { href, puzzle, back, celebrationData, celebrationError }: Props,
) {
  const rippleDuration = useMemo(
    () => getBoardRippleDuration(puzzle.value.board.destination),
    [puzzle.value.board.destination.x, puzzle.value.board.destination.y],
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

  const isOpen = hasSolution && minElapsed;

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

  const isNewPath = data?.isNewPath ?? false;
  const puzzleStats = data?.puzzleStats ?? defaultPuzzleStats;
  const userStats = data?.userStats ?? null;

  const isOptimal = moves.length === puzzle.value.minMoves;
  const headline = isOptimal
    ? `Perfect — ${moves.length} moves`
    : `Solved — ${moves.length} moves`;

  const celebration = useMemo(
    () =>
      getCelebration(
        { moveCount: moves.length, isNewPath },
        puzzle.value,
        { puzzle: puzzleStats, user: userStats },
      ),
    [moves.length, isNewPath, puzzle.value, puzzleStats, userStats],
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
              {isError ? "Couldn't load stats." : celebration.body}
            </p>
          )}
      </div>

      <div className="flex flex-col gap-fl-1 items-stretch">
        <div className="flex gap-fl-1">
          <a
            href={`/puzzles/${puzzle.value.slug}/solutions`}
            className="btn flex-1 justify-center"
          >
            <Icon icon={Ranking} /> See solves
          </a>

          <a
            href="/puzzles/recommended"
            className="btn flex-1 justify-center"
            data-primary
            autoFocus
          >
            One more <Icon icon={ArrowRight} />
          </a>
        </div>

        <div className="flex justify-center gap-fl-2 mt-1">
          {!isOptimal && (
            <a href={getResetHref(href.value)} className="text-text-2 text-1">
              Try again
            </a>
          )}
          <a href={back.href} className="text-text-2 text-1">
            {back.label}
          </a>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Picks the single best celebration body to show. Ranked by rarity — first match wins:
 *
 * 1. First solver ever
 * 2. First perfect solve (on this puzzle)
 * 3. New canonical path (only if within ~2 moves of optimal)
 * 4. Streak milestone (new best, or round number like 5/10/15)
 * 5. Active streak (> 1)
 * 6. Fallback (player count or generic)
 *
 * Headline is always derived locally: "Perfect — X moves" / "Solved — X moves".
 *
 * TODO: replace the rarity / unique-solver framing with percentile-based stats —
 * "You're in the top X% of solvers on this puzzle" or "Faster than X% of solves".
 * More motivating, more actionable, and survives once the puzzle has many solvers.
 */
function getCelebration(
  solve: { moveCount: number; isNewPath: boolean },
  puzzle: Puzzle,
  stats: { puzzle: PuzzleStats; user: UserStats | null },
): CelebrationContent {
  const { moveCount, isNewPath } = solve;
  const { totalSolutions, solutionsHistogram, uniqueSolvers } = stats.puzzle;
  const { user: userStats } = stats;
  const isOptimal = moveCount === puzzle.minMoves;

  // 1. First solver: only this user's solution exists in fresh stats
  if (totalSolutions <= 1) {
    return {
      case: "first-solver",
      body: "No one cracked this one before you.",
    };
  }

  // 2. First perfect solve: at most one entry in histogram at this count
  if (isOptimal && (solutionsHistogram[moveCount] ?? 0) <= 1) {
    return {
      case: "first-optimal",
      body: "You found the first perfect solve!",
    };
  }

  // 3. New canonical path, only celebrate when close to optimal (~2 moves)
  if (isNewPath && puzzle.minMoves && moveCount <= puzzle.minMoves + 2) {
    return {
      case: "new-path",
      body: "Nice thinking — no one found this route before",
    };
  }

  // 4. Streak milestone: new personal best or round number (5, 10, 15…)
  if (userStats && userStats.currentStreak > 1) {
    const isNewBest = userStats.currentStreak >= userStats.bestStreak;
    const isRound = userStats.currentStreak % 5 === 0;
    if (isNewBest || isRound) {
      return {
        case: "streak-milestone",
        body: isNewBest
          ? `${userStats.currentStreak}-puzzle streak — new personal best!`
          : `${userStats.currentStreak} puzzles in a row!`,
      };
    }
  }

  // 5. Active streak
  if (userStats && userStats.currentStreak > 1) {
    return {
      case: "streak",
      body: `${userStats.currentStreak}-puzzle streak - keep it going :)`,
    };
  }

  // 6. Fallback
  return {
    case: "other-solvers",
    body: `${uniqueSolvers - 1} ${
      uniqueSolvers === 2 ? "other player" : "other players"
    } solved this`,
  };
}
