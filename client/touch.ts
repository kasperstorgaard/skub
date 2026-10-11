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

// Gesture rules, matching zingtouch 1.0.6 Swipe/Tap as we configured them.
const SWIPE_MIN_MOVES = 3;
const SWIPE_ESCAPE_VELOCITY = 0.25; // px/ms
const SWIPE_MAX_REST_TIME = 100; // ms
const TAP_MAX_DELAY = 300; // ms
const TAP_MOVE_TOLERANCE = 10; // px per step, per axis

export type GesturePoint = { x: number; y: number; time: number };

type GestureTrace = {
  start: GesturePoint;
  moves: GesturePoint[];
  end: GesturePoint;
  region: { left: number; top: number; width: number; height: number };
};

/**
 * Reads a single-pointer trace as a swipe and/or a tap.
 * Swipe and tap are judged independently, as zingtouch did.
 */
export function readGesture({ start, moves, end, region }: GestureTrace) {
  const isInRegion = ({ x, y }: GesturePoint) =>
    x > region.left && x < region.left + region.width &&
    y > region.top && y < region.top + region.height;

  // Every point before the lift must stay inside the region.
  if (![start, ...moves].every(isInRegion)) {
    return { swipe: null, isTap: false };
  }

  return { swipe: readSwipe(moves, end), isTap: isTap(start, moves, end) };
}

function readSwipe(moves: GesturePoint[], end: GesturePoint) {
  if (moves.length < SWIPE_MIN_MOVES) return null;

  const current = moves[moves.length - 1];
  if (end.time - current.time > SWIPE_MAX_REST_TIME) return null;

  // Latest earlier move with a different timestamp.
  let previous: GesturePoint | null = null;
  for (let i = moves.length - 2; i >= 0; i--) {
    if (moves[i].time !== current.time) {
      previous = moves[i];
      break;
    }
  }
  if (!previous) return null;

  const dx = current.x - previous.x;
  const dy = current.y - previous.y;
  const distance = Math.round(Math.sqrt(dx * dx + dy * dy) * 100) / 100;
  const velocity = distance / (current.time - previous.time);
  if (velocity < SWIPE_ESCAPE_VELOCITY) return null;

  return { direction: angleToDirection(getAngle(dx, dy)), velocity };
}

function isTap(start: GesturePoint, moves: GesturePoint[], end: GesturePoint) {
  const delay = end.time - start.time;
  if (delay < 0 || delay > TAP_MAX_DELAY) return false;

  return moves.every((move, i) => {
    const prev = i === 0 ? start : moves[i - 1];
    return Math.abs(move.x - prev.x) <= TAP_MOVE_TOLERANCE &&
      Math.abs(move.y - prev.y) <= TAP_MOVE_TOLERANCE;
  });
}

/** Screen delta to unit-circle degrees (0=right, 90=up), as zingtouch. */
function getAngle(dx: number, dy: number): number {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return 360 - (angle < 0 ? 360 + angle : angle);
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
