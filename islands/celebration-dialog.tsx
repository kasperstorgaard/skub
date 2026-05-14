import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useState } from "preact/hooks";

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
      const type = getCelebrationType(moves.length, puzzle.value, {
        puzzleStats,
        isNewPath,
      });
      return getMessage(type, moves.length, puzzleStats);
    },
    [moves.length, puzzle.value, puzzleStats, isNewPath],
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
            Play one more <Icon icon={ArrowRight} />
          </a>
        </div>

        <div className="flex justify-center gap-fl-2 mt-1">
          {!isPerfect && (
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
