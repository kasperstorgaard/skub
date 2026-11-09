import { type Signal } from "@preact/signals";
import { useEffect, useMemo, useState } from "preact/hooks";

import { DialogActions, DISMISS } from "#/components/dialog-actions.tsx";
import { ArrowRight, Icon, Ranking } from "#/components/icons.tsx";
import { Stars } from "#/components/stars.tsx";
import { isValidSolution, resolveMoves } from "#/game/board.ts";
import { getSolveScore, type ScoreKind } from "#/game/score.ts";
import { Puzzle } from "#/game/types.ts";
import { decodeState, getResetHref } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { getBoardRippleDuration } from "#/lib/board-ripple.ts";

// Where a star starts its fly-in, in em from where it lands: five spots evenly
// spaced on a 1em circle around 2 right, 3 up, outside the dialog.
const FLY_BASE = [2, -3];
const FLY_RADIUS = 1;
const FLY_STARTS = [0, 1, 2, 3, 4].map((i) => {
  const radians = (i * 2 * Math.PI) / 5;
  return [
    FLY_BASE[0] + FLY_RADIUS * Math.cos(radians),
    FLY_BASE[1] + FLY_RADIUS * Math.sin(radians),
  ];
});

export type CelebrationData = {
  /** This solve's stars, first included. */
  stars: ScoreKind[];
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
  const flyStarts = useMemo(() => pickFlyStarts(), []);
  // This solve's stars; first is only known once the solve lands.
  const stars = data?.stars ??
    getSolveScore(puzzle.value, {
      moves: moves.length,
      isNewPath: false,
      flash: !!isFlash,
    });
  const headline = !isPerfect
    ? "Solved!"
    : stars.includes("first")
    ? "Amazing!"
    : "Perfect!";

  return (
    <Dialog open={isOpen} className="w-full overflow-visible">
      {/* Overflow visible: the stars fly in from outside the dialog */}
      <div className="flex flex-col gap-fl-2">
        {/* The payoff, beside the headline so nothing shifts when it lands */}
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-fl-2 font-semibold text-text-1">
            {headline}
          </h2>

          <Stars
            kinds={stars}
            className="shrink-0 text-[calc(var(--text-fl-2)*1.25)]"
            getStarProps={(kind) => {
              // Right to left, so each lands on top of the one before.
              const i = stars.length - 1 - stars.indexOf(kind);
              const [x, y] = flyStarts[i];
              return {
                className: "star-fly",
                style: {
                  "--fly-x": `${x.toFixed(2)}em`,
                  "--fly-y": `${y.toFixed(2)}em`,
                  "--fly-delay": `${i * 400}ms`,
                },
              };
            }}
          />
        </div>

        <p className="text-3 text-text-2">
          {celebrationError.value
            ? "Couldn't save your solution."
            : "Thanks for playing. What's next?"}
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
              Play it again
            </a>
          )}
      >
        {/* Flash solutions are their own tab */}
        <a
          href={`/puzzles/${puzzle.value.slug}/solutions${
            isFlash ? "?tab=flash" : ""
          }`}
          className="btn"
        >
          <Icon icon={Ranking} /> See solutions
        </a>

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

/** Three of the five starts, no two the same. */
function pickFlyStarts() {
  return [...FLY_STARTS].sort(() => Math.random() - 0.5).slice(0, 3);
}
