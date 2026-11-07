import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useState } from "preact/hooks";

import { DialogActions, DISMISS } from "#/components/dialog-actions.tsx";
import { ArrowRight, Icon, Ranking } from "#/components/icons.tsx";
import { Stars } from "#/components/stars.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import type { ScoreKind } from "#/game/score.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { getBoardRippleDuration } from "#/lib/board-ripple.ts";

const MESSAGES = ["Nice solution", "Well done", "Well played"] as const;

// Where a star starts its fly-in, in em from where it lands: five spots evenly
// spaced on a 1em circle around 4 left, 2 up.
const FLY_BASE = [-4, -2];
const FLY_RADIUS = 1;
const FLY_STARTS = [0, 1, 2, 3, 4].map((i) => {
  const radians = (i * 2 * Math.PI) / 5;
  return [
    FLY_BASE[0] + FLY_RADIUS * Math.cos(radians),
    FLY_BASE[1] + FLY_RADIUS * Math.sin(radians),
  ];
});

export type CelebrationData = {
  /** Stars this solve earned on the puzzle: only the new ones. */
  earned: ScoreKind[];
};

type Props = {
  href: Signal<string>;
  puzzle: Signal<Puzzle>;
  back: { href: string; label: string };
  celebrationData: Signal<CelebrationData | null>;
  celebrationError: Signal<boolean>;
  /** A Flash solve: off the leaderboard, so no link to it. */
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
  const isPerfect = moves.length === puzzle.value.minMoves;
  const headline = isPerfect ? "Perfect!" : "Solved!";
  // Picked once, so it holds still when the stars land.
  const message = useMemo(() => pickRandom(MESSAGES), []);
  const flyStyle = useMemo(() => getFlyStyle(), []);

  return (
    <Dialog open={isOpen} className="w-full">
      <div className="flex flex-col gap-fl-2">
        {/* The payoff, beside the headline so nothing shifts when it lands */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-fl-2 font-semibold text-text-1">
            {headline}
          </h2>

          {data && data.earned.length > 0 && (
            <Stars
              kinds={data.earned}
              className="stars-fly shrink-0 text-fl-2"
              style={flyStyle}
            />
          )}
        </div>

        <p className="text-3 text-text-2">
          {celebrationError.value ? "Couldn't save your solve." : message}
        </p>
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
          // Flash solves are off the leaderboard
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

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** A start for each star, three of the five spots, no two the same. */
function getFlyStyle(): Record<string, string> {
  const [a, b, c] = [...FLY_STARTS]
    .sort(() => Math.random() - 0.5)
    .map(([x, y]) => ({ x: `${x.toFixed(2)}em`, y: `${y.toFixed(2)}em` }));
  // Literal keys, so the CSS check sees them set.
  return {
    "--fly-1-x": a.x,
    "--fly-1-y": a.y,
    "--fly-2-x": b.x,
    "--fly-2-y": b.y,
    "--fly-3-x": c.x,
    "--fly-3-y": c.y,
  };
}
