import { flipBoard, getGrid, validateBoard } from "#/game/board.ts";
import type { Board, Piece, Position, Wall } from "#/game/types.ts";

const MAX_ATTEMPTS = 500;

/**
 * Generator algorithm version, stamped onto every stored candidate so the
 * curation set records which generator produced a board. Semver: patch =
 * behaviour-preserving fixes, minor = additive knobs/defaults, major (or the
 * 0.x minor) = placement/symmetry changes that alter the candidate
 * distribution — anything that means feedback buckets aren't comparable
 * across the bump (`compare-generated` buckets by vintage).
 * Candidates stored before 2026-07-22 carry the pre-semver forms "0.4"/"0.5".
 */
export const GENERATOR_VERSION = "0.7.0";

/**
 * How walls are distributed across the board.
 */
export type WallSpread = "mid" | "balanced" | "spread";

// Options for puzzle generation.
export type GenerateOptions = {
  wallsRange: [number, number];
  blockersRange: [number, number];
  wallSpread: WallSpread;
  /**
   * How mirror-symmetric the **wall layout** is, 0..1. Each placed wall gets a
   * mirror partner across each centre axis with this probability, so 0 is
   * free-form and 1 is fully symmetric on both axes. Blockers, puck and
   * destination are unaffected — symmetry shapes structure, not pieces.
   * Defaults to 0.
   */
  symmetry?: number;
  maxAttempts?: number;
};

/**
 * Quadrant boundaries for zone-based wall placement.
 */
type Zone = { x: [number, number]; y: [number, number] };

const QUADRANTS: Zone[] = [
  { x: [0, 3], y: [0, 3] }, // NW
  { x: [4, 7], y: [0, 3] }, // NE
  { x: [0, 3], y: [4, 7] }, // SW
  { x: [4, 7], y: [4, 7] }, // SE
];

const INNER_ZONE: Zone = { x: [2, 5], y: [2, 5] };

/**
 * Generates a random solvable puzzle within the given constraints.
 * Uses pure random placement with solver verification and retry.
 */
export function generate({
  wallsRange,
  blockersRange,
  wallSpread,
  symmetry = 0,
  maxAttempts = MAX_ATTEMPTS,
}: GenerateOptions) {
  for (
    let attempt = 0;
    attempt < maxAttempts;
    attempt++
  ) {
    const board = generateBoard({
      wallsRange,
      blockersRange,
      wallSpread,
      symmetry,
    });

    try {
      validateBoard(board);
      return { board };
    } catch {
      continue;
    }
  }

  throw new Error(
    `Failed to generate a puzzle after ${MAX_ATTEMPTS} attempts`,
  );
}

/**
 * Single attempt at random board generation (no solver verification).
 */
function generateBoard({
  wallsRange,
  blockersRange,
  wallSpread,
  symmetry = 0,
}: Pick<
  GenerateOptions,
  "wallsRange" | "blockersRange" | "wallSpread" | "symmetry"
>): Board {
  // Symmetry mirrors each wall up to 4-fold, so scale the *base wall count* down
  // by the expected expansion (≈1 + 3·symmetry) — this keeps the final symmetric
  // wall layout inside the requested range instead of quadrupling it into an
  // overcrowded, unsolvable mess. Blockers are honoured at their requested count
  // and placed freely: symmetry shapes the wall structure, not the pieces.
  const expansion = 1 + 3 * symmetry;
  const wallCount = Math.max(1, Math.round(randomInt(wallsRange) / expansion));
  const blockerCount = randomInt(blockersRange);

  const walls = symmetrizeWalls(placeWalls(wallCount, wallSpread), symmetry);

  // The expansion scaling above is only right in expectation — rounding plus
  // dropped duplicate reflections can land the symmetrized layout under the
  // requested minimum (a rated 1★ board shipped with fewer walls than the
  // range floor). Top up until the floor is met, symmetrizing the extras so a
  // fully symmetric layout stays flip-invariant.
  for (let retry = 0; retry < 5 && walls.length < wallsRange[0]; retry++) {
    const missing = wallsRange[0] - walls.length;
    const extras = symmetrizeWalls(
      placeWalls(Math.max(1, Math.ceil(missing / expansion)), wallSpread),
      symmetry,
    );
    for (const extra of extras) {
      if (!walls.some((wall) => sameWall(wall, extra))) walls.push(extra);
    }
  }

  // Build full grid of available positions for pieces
  const pieceSpots = getGrid().flatMap((row) => row);

  const pieces: Piece[] = [];
  for (let i = 0; i < blockerCount; i++) {
    pieces.push({ ...takeRandom(pieceSpots), type: "blocker" });
  }
  pieces.push({ ...takeRandom(pieceSpots), type: "puck" });

  const destination = takeRandom(pieceSpots);

  return { destination, pieces, walls };
}

const ORIGIN: Position = { x: 0, y: 0 };

/**
 * Whether two walls occupy the same slot. Positions/walls are unique by
 * `x,y,orientation`.
 */
const sameWall = (a: Wall, b: Wall): boolean =>
  a.x === b.x && a.y === b.y && a.orientation === b.orientation;

/**
 * Reflects walls across a centre axis, reusing `flipBoard`'s coordinate math
 * (which keeps the vertical-wall `x` / horizontal-wall `y` edge alignment).
 */
const mirrorWalls = (walls: Wall[], axis: "horizontal" | "vertical"): Wall[] =>
  flipBoard({ destination: ORIGIN, pieces: [], walls }, axis).walls;

/**
 * Grows a wall set toward mirror symmetry: each base wall gets its horizontal,
 * vertical and both-axis reflection added with probability `symmetry`. At 1 the
 * set is invariant under both flips (fully symmetric); at 0 it's unchanged.
 * Reflections that duplicate an existing wall are dropped.
 */
function symmetrizeWalls(base: Wall[], symmetry: number): Wall[] {
  if (symmetry <= 0) return base;

  const walls = [...base];
  const add = (candidate: Wall) => {
    if (!walls.some((w) => sameWall(w, candidate))) walls.push(candidate);
  };

  for (const wall of base) {
    if (Math.random() < symmetry) add(mirrorWalls([wall], "horizontal")[0]);
    if (Math.random() < symmetry) add(mirrorWalls([wall], "vertical")[0]);
    if (Math.random() < symmetry) {
      add(mirrorWalls(mirrorWalls([wall], "horizontal"), "vertical")[0]);
    }
  }

  return walls;
}

/**
 * Places walls with spread-constrained random positions.
 */
function placeWalls(count: number, spread: WallSpread): Wall[] {
  const walls: Wall[] = [];

  const zones = getWallZones(count, spread);

  for (const zone of zones) {
    const candidates = getPossibleWallPositions(zone);
    if (candidates.length === 0) continue;

    // Try a few times to avoid duplicates
    for (let retry = 0; retry < 10; retry++) {
      const candidate = randomItem(candidates);

      const isDuplicate = walls.some(
        (w) =>
          w.x === candidate.x && w.y === candidate.y &&
          w.orientation === candidate.orientation,
      );

      if (!isDuplicate) {
        walls.push(candidate);
        break;
      }
    }
  }

  return walls;
}

/**
 * Returns one zone per wall to place, based on spread strategy.
 */
function getWallZones(count: number, spread: WallSpread): Zone[] {
  if (spread === "mid") {
    return Array.from({ length: count }, () => INNER_ZONE);
  }

  if (spread === "spread") {
    // Round-robin across all 4 quadrants
    return Array.from({ length: count }, (_, i) => QUADRANTS[i % 4]);
  }

  // balanced: random quadrant per wall, but ensure ≥2 quadrants used
  const zones: Zone[] = [];
  const usedQuadrants = new Set<number>();

  for (let idx = 0; idx < count; idx++) {
    let quadrantIdx: number;

    // For the first 2 walls, force different quadrants
    if (idx < 2 && usedQuadrants.size < 2) {
      do {
        quadrantIdx = randomInt([0, 3]);
      } while (
        usedQuadrants.has(quadrantIdx) && usedQuadrants.size < QUADRANTS.length
      );
    } else {
      quadrantIdx = randomInt([0, 3]);
    }

    usedQuadrants.add(quadrantIdx);
    zones.push(QUADRANTS[quadrantIdx]);
  }

  return zones;
}

/**
 * Returns all valid wall positions within a zone.
 */
function getPossibleWallPositions(zone: Zone): Wall[] {
  const positions: Wall[] = [];

  for (let x = zone.x[0]; x <= zone.x[1]; x++) {
    for (let y = zone.y[0]; y <= zone.y[1]; y++) {
      // Horizontal walls can't be at y=0 (board edge)
      if (y > 0) {
        positions.push({ x, y, orientation: "horizontal" });
      }
      // Vertical walls can't be at x=0 (board edge)
      if (x > 0) {
        positions.push({ x, y, orientation: "vertical" });
      }
    }
  }

  return positions;
}

/**
 * Picks a random item from the array and removes it in place.
 */
function takeRandom<T>(arr: T[]): T {
  const i = randomInt([0, arr.length - 1]);
  return arr.splice(i, 1)[0];
}

function randomInt(range: [number, number]): number {
  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
}

function randomItem<T>(arr: T[]): T {
  return arr[randomInt([0, arr.length - 1])];
}
