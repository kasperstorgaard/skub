import { useSignal } from "@preact/signals";
import { type Signal } from "@preact/signals";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { addTraceParentHeader } from "#/client/tracing.ts";
import { Check, Icon, Ranking, ShareNetwork } from "#/components/icons.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { getShareText } from "#/game/share.ts";
import { UserStats } from "#/game/streak.ts";
import { Puzzle, PuzzleStats } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import type { CelebrateStats } from "#/routes/api/celebrate-stats.ts";

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
  stats: PuzzleStats;
  userStats?: UserStats | null;
};

export function CelebrationDialog({ href, puzzle, stats, userStats }: Props) {
  const [copied, setCopied] = useState(false);

  const liveStats = useSignal<CelebrateStats | null>(null);
  const statsFetched = useSignal(false);

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

  const isNewPath = useMemo(
    () => new URL(href.value).searchParams.get("new_path") === "true",
    [href.value],
  );

  // Fetch fresh stats once the celebrate dialog is open
  useEffect(() => {
    if (dialog !== "celebrate") return;

    const headers = addTraceParentHeader(new Headers());

    fetch(`/api/celebrate-stats?slug=${puzzle.value.slug}`, { headers })
      .then((r) => r.json())
      .then((data: CelebrateStats) => {
        liveStats.value = data;
      })
      .catch(() => {
        // Silently fall back to server-rendered props
      })
      .finally(() => {
        statsFetched.value = true;
      });
  }, [dialog, puzzle.value.slug]);

  const activePuzzleStats = liveStats.value?.puzzleStats ?? stats;
  const activeUserStats = liveStats.value?.userStats ?? userStats ?? null;
  const isLoading = dialog === "celebrate" && !statsFetched.value;

  const isOptimal = moves.length === puzzle.value.minMoves;
  const headline = isOptimal
    ? `Perfect — ${moves.length} moves`
    : `Solved — ${moves.length} moves`;

  const celebration = useMemo(
    () =>
      getCelebration(
        { moveCount: moves.length, isNewPath },
        puzzle.value,
        { puzzle: activePuzzleStats, user: activeUserStats },
      ),
    [moves.length, isNewPath, puzzle.value, activePuzzleStats, activeUserStats],
  );

  const onShare = useCallback(async () => {
    const origin = globalThis.location?.origin ?? "";
    const { text, url } = getShareText({
      origin,
      puzzle: puzzle.value,
      moveCount: moves.length,
      stats: activePuzzleStats,
    });

    try {
      if ("share" in navigator) {
        await globalThis.navigator.share({ text, url });
      } else {
        await globalThis.navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  }, [puzzle.value, moves.length, activePuzzleStats]);

  return (
    <Dialog open={isOpen}>
      <div className="flex flex-col gap-fl-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          {headline}
        </h2>

        {isLoading
          ? <div className="h-[1lh] w-3/4 rounded-1 bg-ui-1/30 animate-pulse" />
          : <p className="text-3 text-text-2">{celebration.body}</p>}
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

        <div className="flex justify-center gap-fl-2 mt-1">
          <a href={getResetHref(href.value)} className="text-text-2 text-1">
            Start over
          </a>
          <a href="/" className="text-text-2 text-1">
            Home
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
