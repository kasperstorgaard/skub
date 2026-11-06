import type { Position, Wall } from "#/game/types.ts";

/** Free: nothing else meets it. Joined: it meets a wall at a corner. */
export type WallEnd = "free" | "joined";

/**
 * A straight run of walls along one grid line. `x`/`y` is the grid point it
 * starts from (its top or left end), `span` how many cells it runs.
 */
export type WallRun = Position & {
  orientation: Wall["orientation"];
  span: number;
  ends: [WallEnd, WallEnd];
};

const toKey = ({ x, y }: Position) => `${x},${y}`;

/**
 * Merges walls into straight runs, through crossings, and marks each end as
 * free or joined so renderers can stop free ends short and overlap joined ones.
 */
export function getWallRuns(walls: Wall[]): WallRun[] {
  // Grid point → how many walls touch it
  const degree = new Map<string, number>();
  const touch = (point: Position) =>
    degree.set(toKey(point), (degree.get(toKey(point)) ?? 0) + 1);

  for (const wall of walls) {
    touch(wall);
    touch(getRunEnd({ ...wall, span: 1 }));
  }

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

  const getEnd = (point: Position): WallEnd =>
    degree.get(toKey(point)) === 1 ? "free" : "joined";

  return runs.map((run) => ({
    ...run,
    ends: [getEnd(run), getEnd(getRunEnd(run))],
  }));
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
