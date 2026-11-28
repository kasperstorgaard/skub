import type { Position } from "#/game/types.ts";

// Per-tile animation duration.
export const TILE_DURATION_MS = 400;
// Delay between rings. All tiles in a ring fire together.
export const RING_STAGGER_MS = 100;

/**
 * Delay (ms) for a single tile at `pos` relative to the destination.
 * Used as an inline style so it's guaranteed present before first paint.
 */
export function getRippleDelay(pos: Position, destination: Position): number {
  const ring = Math.max(
    Math.abs(pos.x - destination.x),
    Math.abs(pos.y - destination.y),
  );
  return ring * RING_STAGGER_MS;
}

/**
 * Total ripple duration for the board — caller uses this to gate when
 * the celebration dialog is allowed to enter.
 */
export function getBoardRippleDuration(destination: Position): number {
  let maxRing = 0;
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      const ring = Math.max(
        Math.abs(x - destination.x),
        Math.abs(y - destination.y),
      );
      if (ring > maxRing) maxRing = ring;
    }
  }
  return maxRing * RING_STAGGER_MS + TILE_DURATION_MS;
}
