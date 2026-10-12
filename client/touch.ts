import type { RefObject } from "preact";
import { useEffect, useRef } from "preact/hooks";

import type { Direction, Piece, Position } from "#/game/types.ts";

export type { Direction };

type UseSwipeOptions = {
  pieces: Piece[];
  onSwipe: (
    piece: Position,
    opts: { direction: Direction; velocity: number; cellSize: number },
  ) => void;
  isEnabled?: boolean;
};

// Maximum distance (in grid cells) from touch point to match a piece.
const PROXIMITY_RADIUS = 1;

/**
 * Velocity and speed thresholds for swipe detection and piece movement.
 */
const MIN_SWIPE_VELOCITY = 0.5; // px/ms
const MAX_SWIPE_VELOCITY = 3; // px/ms
const MIN_PIECE_SPEED = 50; // ms

/**
 * Converts a ZingTouch angle (unit circle degrees) to a cardinal direction.
 *
 * ZingTouch: 0°=right, 90°=up, 180°=left, 270°=down.
 * Quadrants: 315-45°→right, 45-135°→up, 135-225°→left, 225-315°→down.
 */
function angleToDirection(angleDeg: number): Direction {
  const a = ((angleDeg % 360) + 360) % 360;
  if (a >= 315 || a < 45) return "right";
  if (a >= 45 && a < 135) return "up";
  if (a >= 135 && a < 225) return "left";
  return "down";
}

type findNearestPieceOptions = {
  touchX: number;
  touchY: number;
  boardRect: DOMRect;
  pieces: Piece[];
  cellSize: number;
};

/**
 * Board-level swipe detection using ZingTouch.
 * Attaches a single swipe listener to the board container.
 * On touchstart, finds the nearest piece via proximity detection.
 * On swipe, converts angle to direction and calls onSwipe.
 *
 * Mobile only — skips initialization on non-touch devices.
 */
export function useSwipe(
  regionRef: RefObject<HTMLElement>,
  boardRef: RefObject<HTMLElement>,
  { pieces, onSwipe, isEnabled }: UseSwipeOptions,
): void {
  // Use refs for values that change frequently to avoid re-creating the region
  const piecesRef = useRef(pieces);
  piecesRef.current = pieces;

  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    const regionEl = regionRef.current;
    const boardEl = boardRef.current;
    if (!regionEl || !boardEl || !isEnabled) return;
    if (!("ontouchstart" in window)) return;

    // currently touched piece, detected from touchstart
    let touchedPiece: Position | null = null;
    // deno-lint-ignore no-explicit-any
    let region: any = null;
    let destroyed = false;
    let cellSize: number | null = null;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];

      const boardRect = boardEl.getBoundingClientRect();
      cellSize = boardRect.width / 8;

      touchedPiece = findNearestPiece({
        touchX: touch.clientX,
        touchY: touch.clientY,
        boardRect,
        pieces: piecesRef.current,
        cellSize,
      });
    };

    // Load ZingTouch dynamically to avoid SSR issues
    import("zingtouch").then((ZingTouch) => {
      if (destroyed) return;

      regionEl.addEventListener("touchstart", onTouchStart, { passive: true });

      const ZT = ZingTouch.default ?? ZingTouch;
      // Region on wrapper so swipes ending outside the board are still captured
      region = new ZT.Region(regionEl, false, false);

      const swipe = new ZT.Swipe({
        escapeVelocity: 0.25,
        maxRestTime: 100,
      });

      region.bind(regionEl, swipe, (event: CustomEvent) => {
        // If no currently touched piece, ignore the swipe
        if (!touchedPiece) return;

        const data = event.detail.data[0];
        if (!data || !cellSize) return;

        const direction = angleToDirection(data.currentDirection);
        onSwipeRef.current(touchedPiece, {
          direction,
          velocity: data.velocity,
          cellSize,
        });

        // reset the touched piece to get ready for next swipe
        touchedPiece = null;
      });

      // Forward taps through the overlay to the elements underneath
      const tap = new ZT.Tap();

      region.bind(regionEl, tap, (event: CustomEvent) => {
        const input = event.detail.events[0];
        if (!input) return;

        // Temporarily disable pointer events to detect the underlying element
        regionEl.style.pointerEvents = "none";
        const target = document.elementFromPoint(input.clientX, input.clientY);
        // Renable pointer events
        regionEl.style.pointerEvents = "";

        if (target instanceof HTMLElement) target.click();

        // reset touched piece, as we don't want to mix tap and swipe
        touchedPiece = null;
      });
    });

    return () => {
      destroyed = true;
      regionEl.removeEventListener("touchstart", onTouchStart);
      if (region) region.unbind(regionEl);
    };
  }, [regionRef.current, boardRef.current, isEnabled]);
}

/**
 * Calculates animation duration (ms) for a piece move based on swipe velocity.
 * Clamps velocity to [0.5, 3] px/ms range. Returns at least 50ms.
 */
export function calculateMoveSpeed(
  src: Position,
  target: Position,
  opts: { velocity: number; cellSize: number },
): number {
  const diffX = Math.abs(src.x - target.x);
  const diffY = Math.abs(src.y - target.y);
  const distance = Math.max(diffX, diffY) * opts.cellSize;

  const velocity = Math.min(
    Math.max(opts.velocity, MIN_SWIPE_VELOCITY),
    MAX_SWIPE_VELOCITY,
  );

  return Math.max(distance / velocity, MIN_PIECE_SPEED);
}

/**
 * Given a touch point on the board, find the nearest piece within the proximity radius.
 * Returns the piece's position or null.
 */
function findNearestPiece({
  touchX,
  touchY,
  boardRect,
  pieces,
  cellSize,
}: findNearestPieceOptions): Position | null {
  // Convert touch coordinates to grid position (0-7 fractional)
  const gridX = (touchX - boardRect.left) / cellSize;
  const gridY = (touchY - boardRect.top) / cellSize;

  let closest: Piece | null = null;
  let closestDist = Infinity;

  for (const piece of pieces) {
    // Piece center is at (piece.x + 0.5, piece.y + 0.5) in grid space
    const dx = gridX - (piece.x + 0.5);
    const dy = gridY - (piece.y + 0.5);
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < closestDist && dist <= PROXIMITY_RADIUS) {
      closest = piece;
      closestDist = dist;
    }
  }

  return closest;
}
