import { isMoveSame } from "#/game/board.ts";
import type { Move } from "#/game/types.ts";
import type { GameState } from "#/game/url.ts";

/**
 * How many moves of an optimal solution Flash plays for you: 3 from 10 moves,
 * 2 from 8, 1 from 5, and none below that.
 */
export function getHeadStartLength(minMoves: number) {
  if (minMoves >= 10) return 3;
  if (minMoves >= 8) return 2;
  if (minMoves >= 5) return 1;
  return 0;
}

/** The head start from a solution: its first moves, as many as the puzzle allows. */
export function getHeadStart(solution: Move[], minMoves: number) {
  return solution.slice(0, getHeadStartLength(minMoves));
}

/**
 * Whether a game still stands on its head start: the played moves begin with it.
 * The head start is locked, so anything else goes back to it.
 */
export function isOnHeadStart(
  state: Pick<GameState, "moves" | "cursor">,
  headStart: Move[],
) {
  const played = state.moves.slice(0, state.cursor ?? state.moves.length);
  if (played.length < headStart.length) return false;
  return headStart.every((move, index) => isMoveSame(move, played[index]));
}
