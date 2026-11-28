import type { RefObject } from "preact";

import { useArrowKeys } from "#/client/keyboard.ts";
import { useSwipe } from "#/client/touch.ts";
import type { Direction, Piece, Position } from "#/game/types.ts";

const DEFAULT_VELOCITY = 1; // px/ms

export type OnMove = (
  src: Position,
  opts: { direction: Direction; cellSize: number; velocity: number },
) => void;

type UseMoveOptions = {
  pieces: Piece[];
  active?: Position;
  onMove: OnMove;
  isEnabled: boolean;
};

/**
 * Unified input hook for piece movement.
 * Wires up keyboard (arrow keys) and touch (swipe) to a single onMove callback.
 */
export function useMoves(
  swipeRegionRef: RefObject<HTMLElement>,
  boardRef: RefObject<HTMLElement>,
  { pieces, active, onMove, isEnabled }: UseMoveOptions,
): void {
  const onArrowKey = (direction: Direction) => {
    if (!active) return;

    const boardWidth = boardRef.current?.getBoundingClientRect().width ?? 0;
    const cellSize = boardWidth / 8;
    onMove(active, { direction, cellSize, velocity: DEFAULT_VELOCITY });
  };

  useArrowKeys({ onArrowKey, isEnabled });

  useSwipe(swipeRegionRef, boardRef, {
    pieces,
    onSwipe: onMove,
    isEnabled,
  });
}
