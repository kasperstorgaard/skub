import type { Position, Wall } from "#/game/types.ts";

/**
 * Free: nothing else meets it. Bent: it turns a corner into one other wall.
 * Joined: it meets walls that carry on (a T).
 */
export type WallEnd = "free" | "bent" | "joined";

/**
 * A straight run of walls along one grid line. `x`/`y` is the grid point it
 * starts from (its top or left end), `span` how many cells it runs.
 */
export type WallRun = Position & {
  orientation: Wall["orientation"];
  span: number;
  ends: [WallEnd, WallEnd];
};

/** An L corner at a grid point, by the ways its two walls leave it. */
export type WallBend = Position & {
  horizontal: "left" | "right";
  vertical: "up" | "down";
};

type Direction = "up" | "right" | "down" | "left";

/** Wall stroke and the outer radius of its corners, in px */
export const WALL_WIDTH = 2;
export const WALL_BEND_RADIUS = 3;

// The arc's centreline radius: where a bent run's straight part takes over
export const WALL_BEND_START = WALL_BEND_RADIUS - WALL_WIDTH / 2;

const toKey = ({ x, y }: Position) => `${x},${y}`;

/**
 * Merges walls into straight runs, through crossings, finds the L corners
 * between them, and marks each run end so renderers know how to finish it.
 */
export function getWallShapes(
  walls: Wall[],
): { runs: WallRun[]; bends: WallBend[] } {
  // Grid point → the ways walls leave it
  const exits = new Map<string, { point: Position; ways: Set<Direction> }>();
  const exit = (point: Position, way: Direction) => {
    const key = toKey(point);
    if (!exits.has(key)) {
      exits.set(key, { point: { x: point.x, y: point.y }, ways: new Set() });
    }
    exits.get(key)?.ways.add(way);
  };

  for (const wall of walls) {
    const end = getRunEnd({ ...wall, span: 1 });
    if (wall.orientation === "vertical") {
      exit(wall, "down");
      exit(end, "up");
    } else {
      exit(wall, "right");
      exit(end, "left");
    }
  }

  const bends: WallBend[] = [];
  for (const { point, ways } of exits.values()) {
    if (ways.size !== 2) continue;

    const horizontal = ways.has("left")
      ? "left"
      : ways.has("right")
      ? "right"
      : undefined;
    const vertical = ways.has("up")
      ? "up"
      : ways.has("down")
      ? "down"
      : undefined;
    if (horizontal && vertical) bends.push({ ...point, horizontal, vertical });
  }
  bends.sort((a, b) => a.y - b.y || a.x - b.x);

  const getEnd = (point: Position): WallEnd => {
    const ways = exits.get(toKey(point))?.ways.size;
    if (ways === 1) return "free";
    return bends.some((bend) => toKey(bend) === toKey(point))
      ? "bent"
      : "joined";
  };

  return {
    runs: mergeRuns(walls).map((run) => ({
      ...run,
      ends: [getEnd(run), getEnd(getRunEnd(run))],
    })),
    bends,
  };
}

function mergeRuns(walls: Wall[]) {
  const sorted = walls.toSorted((a, b) =>
    a.orientation.localeCompare(b.orientation) ||
    getLine(a) - getLine(b) ||
    getAlong(a) - getAlong(b)
  );

  const runs: Omit<WallRun, "ends">[] = [];

  for (const wall of sorted) {
    const last = runs.at(-1);

    if (
      last && last.orientation === wall.orientation &&
      getLine(last) === getLine(wall) &&
      getAlong(last) + last.span === getAlong(wall)
    ) {
      last.span++;
    } else {
      runs.push({
        x: wall.x,
        y: wall.y,
        orientation: wall.orientation,
        span: 1,
      });
    }
  }

  return runs;
}

function getRunEnd(run: Omit<WallRun, "ends">): Position {
  return run.orientation === "vertical"
    ? { x: run.x, y: run.y + run.span }
    : { x: run.x + run.span, y: run.y };
}

// The grid line a wall sits on, and where along it
function getLine(wall: Wall) {
  return wall.orientation === "vertical" ? wall.x : wall.y;
}

function getAlong(wall: Wall) {
  return wall.orientation === "vertical" ? wall.y : wall.x;
}

/**
 * A bend's arc relative to its grid point, from the tangent on its vertical
 * wall to the one on its horizontal wall, to stroke at `WALL_WIDTH`.
 */
export function getBendPath(bend: WallBend) {
  const r = WALL_BEND_START;
  const dx = bend.horizontal === "right" ? r : -r;
  const dy = bend.vertical === "down" ? r : -r;
  const sweep = (bend.horizontal === "right") === (bend.vertical === "down")
    ? 1
    : 0;

  return `M0 ${dy}A${r} ${r} 0 0 ${sweep} ${dx} 0`;
}
