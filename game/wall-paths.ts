import type { Position, Wall } from "#/game/types.ts";

// Up, right, down, left: the order a trace tries turns in
const STEPS: Position[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const toKey = ({ x, y }: Position) => `${x},${y}`;

/**
 * Traces walls into SVG path data in grid units, where grid line `k` sits at
 * `k`. Connected walls become one path that runs straight through crossings
 * where it can; a run that ends where it started closes with `Z`.
 */
export function getWallPaths(walls: Wall[]): string[] {
  // Grid point → directions of the untraced edges leaving it
  const edges = new Map<string, Set<number>>();
  const points = new Map<string, Position>();

  const link = (point: Position, step: number) => {
    const key = toKey(point);
    points.set(key, point);
    edges.set(key, (edges.get(key) ?? new Set()).add(step));
  };

  for (const wall of walls) {
    const step = wall.orientation === "vertical" ? 2 : 1;
    link(wall, step);
    link(move(wall, step), (step + 2) % 4);
  }

  // Top to bottom, left to right, so the output is stable
  const ordered = [...points.values()].sort((a, b) => a.y - b.y || a.x - b.x);
  const degree = (point: Position) => edges.get(toKey(point))?.size ?? 0;

  const paths: string[] = [];

  while (true) {
    // Loose ends first, so open runs start at an end, not mid-way
    const start = ordered.find((point) => degree(point) % 2 === 1) ??
      ordered.find((point) => degree(point) > 0);
    if (!start) break;

    paths.push(trace(start, edges));
  }

  return paths;
}

function trace(start: Position, edges: Map<string, Set<number>>) {
  const corners = [start];
  let current = start;
  let heading: number | undefined;

  while (true) {
    const open = edges.get(toKey(current));
    if (!open?.size) break;

    const step = heading !== undefined && open.has(heading)
      ? heading
      : Math.min(...open);
    if (heading !== undefined && step !== heading) corners.push(current);

    const next = move(current, step);
    open.delete(step);
    edges.get(toKey(next))?.delete((step + 2) % 4);

    current = next;
    heading = step;
  }

  const isClosed = corners.length > 1 && toKey(current) === toKey(start);
  if (!isClosed) corners.push(current);

  const [first, ...rest] = corners;
  const segments = rest.map((corner, index) => {
    const previous = corners[index];
    return corner.x === previous.x ? `V${corner.y}` : `H${corner.x}`;
  });

  return `M${first.x} ${first.y}${segments.join("")}${isClosed ? "Z" : ""}`;
}

function move(point: Position, step: number): Position {
  return { x: point.x + STEPS[step].x, y: point.y + STEPS[step].y };
}
