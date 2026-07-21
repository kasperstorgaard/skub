import {
  COLS,
  flipBoard,
  isPositionSame,
  resolveMoves,
  rotateBoard,
  ROWS,
} from "#/game/board.ts";
import {
  enumerateSolutions,
  optimalFirstMoves,
  solveExhaustiveSync,
  type SolverResult,
} from "#/game/solver.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";
import type {
  Board,
  Difficulty,
  Direction,
  Move,
  Position,
  Wall,
} from "#/game/types.ts";

/**
 * Puzzle scoring — gates and scores a board from its exhaustive solve.
 *
 * Consumes the shortest-path DAG from `solveExhaustiveSync` (see `solver.ts`) and
 * canonicalizes solutions before measuring, so metrics reflect distinct routes
 * rather than the raw, order-transposition-inflated move sequences.
 */

/** The 8 symmetries of the square (dihedral group D4). */
export type DihedralTransform =
  | "identity"
  | "r90"
  | "r180"
  | "r270"
  | "flipH"
  | "flipH_r90"
  | "flipH_r180"
  | "flipH_r270";

const DIHEDRAL_TRANSFORMS: DihedralTransform[] = [
  "identity",
  "r90",
  "r180",
  "r270",
  "flipH",
  "flipH_r90",
  "flipH_r180",
  "flipH_r270",
];

/** Applies a dihedral transform to a board via the existing rotate/flip helpers. */
function applyDihedral(board: Board, transform: DihedralTransform): Board {
  switch (transform) {
    case "identity":
      return board;
    case "r90":
      return rotateBoard(board, "right");
    case "r180":
      return rotateBoard(rotateBoard(board, "right"), "right");
    case "r270":
      return rotateBoard(board, "left");
    case "flipH":
      return flipBoard(board, "horizontal");
    case "flipH_r90":
      return rotateBoard(flipBoard(board, "horizontal"), "right");
    case "flipH_r180":
      return rotateBoard(
        rotateBoard(flipBoard(board, "horizontal"), "right"),
        "right",
      );
    case "flipH_r270":
      return rotateBoard(flipBoard(board, "horizontal"), "left");
  }
}

/**
 * Encodes a board into a comparable numeric array:
 * `[puckPos, destPos, ...sortedBlockers, 255, ...sortedWalls]`, where positions
 * are `y*8+x` and walls are `(y*8+x)*2 + (horizontal ? 0 : 1)`. Blockers and walls
 * are sorted so array order never depends on input order.
 */
function encodeBoard(board: Board): number[] {
  const puck = board.pieces.find((p) => p.type === "puck")!;
  const puckPos = puck.y * COLS + puck.x;
  const destPos = board.destination.y * COLS + board.destination.x;

  const blockers = board.pieces
    .filter((p) => p.type === "blocker")
    .map((p) => p.y * COLS + p.x)
    .sort((a, b) => a - b);

  const walls = board.walls
    .map((w) =>
      (w.y * COLS + w.x) * 2 + (w.orientation === "horizontal" ? 0 : 1)
    )
    .sort((a, b) => a - b);

  return [puckPos, destPos, ...blockers, 255, ...walls];
}

/** Lexicographic comparison of two encodings; shorter is smaller when prefixes tie. */
function compareEncodings(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}

/**
 * Canonical hash of a board, invariant under the 8 dihedral symmetries and under
 * blocker/wall ordering: the lexicographically smallest encoding across all
 * transforms, JSON-stringified. Two boards that are rotations/reflections of each
 * other hash identically — used to dedupe a puzzle corpus.
 */
export function boardCanonicalHash(board: Board): string {
  let min: number[] | null = null;
  for (const transform of DIHEDRAL_TRANSFORMS) {
    const encoding = encodeBoard(applyDihedral(board, transform));
    if (min === null || compareEncodings(encoding, min) < 0) min = encoding;
  }
  return JSON.stringify(min);
}

/**
 * The non-identity dihedral transforms under which the board maps onto itself
 * (its encoding is unchanged). A non-empty result means the board has symmetry,
 * which solution canonicalization must fold over.
 */
export function boardSelfSymmetries(board: Board): DihedralTransform[] {
  const base = encodeBoard(board);
  const symmetries: DihedralTransform[] = [];
  for (const transform of DIHEDRAL_TRANSFORMS) {
    if (transform === "identity") continue;
    if (
      compareEncodings(encodeBoard(applyDihedral(board, transform)), base) === 0
    ) {
      symmetries.push(transform);
    }
  }
  return symmetries;
}

/** One cell swept by a piece during a move. */
export type TrailCell = {
  pos: number; // y*8+x
  pieceRole: "puck" | "blocker";
  direction: Direction;
  moveIndex: number;
};

/** The direction a slide travels, from its endpoints (moves are single-axis). */
function moveDirection(from: Position, to: Position): Direction {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  if (to.y > from.y) return "down";
  return "up";
}

/** Every cell a slide passes through, inclusive of both endpoints, as `y*8+x`. */
function cellsBetween(from: Position, to: Position): number[] {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const cells: number[] = [];
  let x = from.x;
  let y = from.y;
  cells.push(y * COLS + x);
  while (x !== to.x || y !== to.y) {
    x += dx;
    y += dy;
    cells.push(y * COLS + x);
  }
  return cells;
}

/**
 * The trail of each solution: for every move, the cells it sweeps tagged with the
 * moving piece's role, the slide direction, and the move index. Re-resolves the
 * board before each move to identify which piece moved. Trails drive overlap,
 * coverage, and canonicalization.
 */
export function computeTrails(
  board: Board,
  solutions: Move[][],
): TrailCell[][] {
  return solutions.map((moves) => {
    const trail: TrailCell[] = [];
    for (let i = 0; i < moves.length; i++) {
      const [from, to] = moves[i];
      const pre = resolveMoves(board, moves.slice(0, i));
      const piece = pre.pieces.find((p) => isPositionSame(p, from))!;
      const direction = moveDirection(from, to);
      for (const pos of cellsBetween(from, to)) {
        trail.push({ pos, pieceRole: piece.type, direction, moveIndex: i });
      }
    }
    return trail;
  });
}

/**
 * Deduplicates optimal solutions into distinct solutions, keeping one
 * representative per group. Reuses `getCanonicalMoveKey` — the same
 * order-independent "sorted move multiset" key the KV/highscore path uses to
 * group solutions — so scoring counts distinct solutions exactly as the product
 * does: two solutions with the same set of moves in any order are one class.
 */
export function deduplicateSolutions(solutions: Move[][]): Move[][] {
  const seen = new Set<string>();
  const representatives: Move[][] = [];

  for (const moves of solutions) {
    const key = getCanonicalMoveKey(moves);
    if (seen.has(key)) continue;
    seen.add(key);
    representatives.push(moves);
  }

  return representatives;
}

/** The role of the piece that moves in each move (found by re-resolving). */
function moveRoles(board: Board, moves: Move[]): ("puck" | "blocker")[] {
  return moves.map((move, i) =>
    resolveMoves(board, moves.slice(0, i))
      .pieces.find((p) => isPositionSame(p, move[0]))!.type
  );
}

// ── Single-solution metrics ──────────────────────────────────────────────
// Each measures one solution `(board, moves) => number`; computeMetrics reduces
// across the distinct solutions (max, or min for the two penalties).

/**
 * Setup ratio — fraction of a solution's moves that reposition a blocker rather
 * than the puck (more setup ⇒ harder).
 */
export function setupRatio(board: Board, moves: Move[]): number {
  if (moves.length === 0) return 0;
  return moveRoles(board, moves).filter((r) => r === "blocker").length /
    moves.length;
}

/**
 * Coverage — distinct cells the puck sweeps in a solution, as a fraction of the
 * 64-cell board.
 */
export function coverage(board: Board, moves: Move[]): number {
  const trail = computeTrails(board, [moves])[0];
  return new Set(
    trail.filter((c) => c.pieceRole === "puck").map((c) => c.pos),
  ).size / (COLS * ROWS);
}

const posOf = (p: Position): number => p.y * COLS + p.x;

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** A stable id (index into the initial pieces) for the piece that moves each move. */
function movePieceIds(board: Board, moves: Move[]): number[] {
  const current = board.pieces.map(posOf);
  return moves.map(([from, to]) => {
    const id = current.indexOf(posOf(from));
    current[id] = posOf(to);
    return id;
  });
}

/**
 * Total slide distance in a solution — Manhattan distance summed over every move
 * (puck and blocker alike).
 */
export function totalDistance(_board: Board, moves: Move[]): number {
  let total = 0;
  for (const [from, to] of moves) {
    total += Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
  }
  return total;
}

/**
 * Deception — how far the puck slides *away* from the destination in a solution,
 * summed over its puck moves (per-axis, net non-negative). This is what actually
 * misleads a human solver.
 */
export function deception(board: Board, moves: Move[]): number {
  const d = board.destination;
  const roles = moveRoles(board, moves);
  let sum = 0;
  for (let i = 0; i < moves.length; i++) {
    if (roles[i] !== "puck") continue;
    const [from, to] = moves[i];
    const onX = from.y === to.y;
    const before = onX ? Math.abs(from.x - d.x) : Math.abs(from.y - d.y);
    const after = onX ? Math.abs(to.x - d.x) : Math.abs(to.y - d.y);
    sum += Math.max(0, after - before);
  }
  return sum;
}

/**
 * Reversals — consecutive moves of the *same* piece in opposite directions within
 * a solution (other pieces may move in between).
 */
export function reversals(board: Board, moves: Move[]): number {
  const ids = movePieceIds(board, moves);
  const dirs = new Map<number, Direction[]>();
  for (let i = 0; i < moves.length; i++) {
    const [from, to] = moves[i];
    const list = dirs.get(ids[i]) ?? [];
    list.push(moveDirection(from, to));
    dirs.set(ids[i], list);
  }
  let count = 0;
  for (const list of dirs.values()) {
    for (let k = 1; k < list.length; k++) {
      if (OPPOSITE[list[k - 1]] === list[k]) count++;
    }
  }
  return count;
}

/**
 * Cross-trail overlap — cells in a solution swept by two or more *different*
 * pieces (a piece crossing another's path). Self-overlap is excluded.
 */
export function crossTrailOverlap(board: Board, moves: Move[]): number {
  const ids = movePieceIds(board, moves);
  const cellPieces = new Map<number, Set<number>>();
  for (const cell of computeTrails(board, [moves])[0]) {
    const set = cellPieces.get(cell.pos) ?? new Set();
    set.add(ids[cell.moveIndex]);
    cellPieces.set(cell.pos, set);
  }
  let count = 0;
  for (const set of cellPieces.values()) if (set.size >= 2) count++;
  return count;
}

const inBounds = (p: Position): boolean =>
  p.x >= 0 && p.x < COLS && p.y >= 0 && p.y < ROWS;

/** The cell one step beyond a position in a direction. */
function beyondCell(pos: Position, direction: Direction): Position {
  if (direction === "up") return { x: pos.x, y: pos.y - 1 };
  if (direction === "down") return { x: pos.x, y: pos.y + 1 };
  if (direction === "left") return { x: pos.x - 1, y: pos.y };
  return { x: pos.x + 1, y: pos.y };
}

/** Whether a wall sits between `to` and the next cell in `direction`. */
function wallBeyond(walls: Board["walls"], to: Position, direction: Direction) {
  return walls.some((w) => {
    if (direction === "right") {
      return w.orientation === "vertical" && w.y === to.y && w.x === to.x + 1;
    }
    if (direction === "left") {
      return w.orientation === "vertical" && w.y === to.y && w.x === to.x;
    }
    if (direction === "down") {
      return w.orientation === "horizontal" && w.x === to.x && w.y === to.y + 1;
    }
    return w.orientation === "horizontal" && w.x === to.x && w.y === to.y;
  });
}

type MoveAnalysis = {
  moverId: number;
  cause: "edge" | "wall" | "piece";
  stoppingId: number | null;
};

/**
 * Per-move analysis of a solution: which piece moved (`moverId`, a stable index
 * into the initial pieces), why the slide stopped (`edge`/`wall`/`piece`), and —
 * for piece stops — which piece stopped it (`stoppingId`). Simulates piece
 * positions itself (no board re-resolve), so the whole solution is one pass.
 */
function analyzeMoves(board: Board, moves: Move[]): MoveAnalysis[] {
  const posToId = new Map<number, number>();
  for (let i = 0; i < board.pieces.length; i++) {
    posToId.set(posOf(board.pieces[i]), i);
  }

  return moves.map(([from, to]) => {
    const moverId = posToId.get(posOf(from))!;
    const direction = moveDirection(from, to);
    const beyond = beyondCell(to, direction);

    let cause: MoveAnalysis["cause"] = "edge";
    let stoppingId: number | null = null;
    if (inBounds(beyond)) {
      if (wallBeyond(board.walls, to, direction)) cause = "wall";
      else if (posToId.has(posOf(beyond))) {
        cause = "piece";
        stoppingId = posToId.get(posOf(beyond))!;
      }
    }

    posToId.delete(posOf(from));
    posToId.set(posOf(to), moverId);
    return { moverId, cause, stoppingId };
  });
}

/**
 * Stop weight — how a solution's slides end, scored `piece×3 + wall×2 + edge`.
 * Piece stops are the most interesting to solve around, edges the least.
 */
export function stopWeighted(board: Board, moves: Move[]): number {
  let edge = 0;
  let wall = 0;
  let piece = 0;
  for (const a of analyzeMoves(board, moves)) {
    if (a.cause === "edge") edge++;
    else if (a.cause === "wall") wall++;
    else piece++;
  }
  return piece * 3 + wall * 2 + edge;
}

/**
 * Piece usage — `Σ_p log2(1 + uses(p)) + log2(1 + U)` over non-puck pieces in a
 * solution, where `uses(p)` counts moves in which blocker `p` moves or is the
 * stopping piece, and `U` is how many blockers are used at all.
 */
export function pieceUsage(board: Board, moves: Move[]): number {
  const blockerIds = board.pieces
    .map((p, i) => (p.type === "blocker" ? i : -1))
    .filter((i) => i >= 0);

  const uses = new Map<number, number>();
  const bump = (id: number) => uses.set(id, (uses.get(id) ?? 0) + 1);
  for (const a of analyzeMoves(board, moves)) {
    if (board.pieces[a.moverId].type === "blocker") bump(a.moverId);
    if (
      a.cause === "piece" && a.stoppingId !== null &&
      board.pieces[a.stoppingId].type === "blocker"
    ) bump(a.stoppingId);
  }
  let sum = 0;
  let used = 0;
  for (const id of blockerIds) {
    const u = uses.get(id) ?? 0;
    sum += Math.log2(1 + u);
    if (u > 0) used++;
  }
  return sum + Math.log2(1 + used);
}

/**
 * Pointless clearance (N1, negative) — blocker moves in a solution after which
 * that blocker never interacts again (never moves, never stops another piece).
 */
export function pointlessClearance(board: Board, moves: Move[]): number {
  const analysis = analyzeMoves(board, moves);
  let count = 0;
  for (let i = 0; i < analysis.length; i++) {
    const a = analysis[i];
    if (board.pieces[a.moverId].type !== "blocker") continue;
    const interactsLater = analysis.slice(i + 1).some((later) =>
      later.moverId === a.moverId || later.stoppingId === a.moverId
    );
    if (!interactsLater) count++;
  }
  return count;
}

/**
 * Same-direction repeat (N2, negative) — cells a single piece re-traverses in the
 * same direction within a solution. Per extra traversal.
 */
export function sameDirectionRepeat(board: Board, moves: Move[]): number {
  const analysis = analyzeMoves(board, moves);
  const counts = new Map<string, number>();
  for (const cell of computeTrails(board, [moves])[0]) {
    const key = `${
      analysis[cell.moveIndex].moverId
    }:${cell.pos}:${cell.direction}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let repeats = 0;
  for (const c of counts.values()) if (c > 1) repeats += c - 1;
  return repeats;
}

// ── Multiple-solution metrics ────────────────────────────────────────────
// Measure the set / union of the distinct solutions `(board, solutions) => number`.

/** Distinct optimal solutions — how many genuinely different winning routes exist. */
export function uniqueSolutions(_board: Board, solutions: Move[][]): number {
  return solutions.length;
}

/** Wall key `x,y,orientation`, for stop-cause set membership. */
const wallKey = (w: Wall): string => `${w.x},${w.y},${w.orientation}`;

/** The wall responsible for a wall-caused stop at `to` moving `direction`. */
function stoppingWallKey(to: Position, direction: Direction): string {
  if (direction === "right") return `${to.x + 1},${to.y},vertical`;
  if (direction === "left") return `${to.x},${to.y},vertical`;
  if (direction === "down") return `${to.x},${to.y + 1},horizontal`;
  return `${to.x},${to.y},horizontal`;
}

/**
 * Wall utilization — fraction of the board's interior walls that stop at least
 * one slide across the union of all distinct solutions. Walls that never stop a
 * piece are decorative clutter. Vacuously 1 when the board has no walls.
 *
 * Caveat: a wall can shape a puzzle by preventing a shortcut without ever being
 * the *stopping* cause of an optimal move; such walls read as unused here. The
 * G7 threshold is deliberately loose to tolerate this.
 */
export function wallUtilization(board: Board, solutions: Move[][]): number {
  if (board.walls.length === 0) return 1;
  const used = new Set<string>();
  for (const moves of solutions) {
    const analysis = analyzeMoves(board, moves);
    for (let i = 0; i < moves.length; i++) {
      if (analysis[i].cause !== "wall") continue;
      const [from, to] = moves[i];
      used.add(stoppingWallKey(to, moveDirection(from, to)));
    }
  }
  const boardKeys = new Set(board.walls.map(wallKey));
  let hit = 0;
  for (const k of used) if (boardKeys.has(k)) hit++;
  return hit / board.walls.length;
}

/** Cells carrying structure or action: trails + initial pieces + destination. */
function visitedCells(board: Board, solutions: Move[][]): Set<number> {
  const visited = new Set<number>();
  visited.add(posOf(board.destination));
  for (const p of board.pieces) visited.add(posOf(p));
  for (const trail of computeTrails(board, solutions)) {
    for (const c of trail) visited.add(c.pos);
  }
  return visited;
}

/**
 * Dead space — fraction of the board's cells that no trail ever enters and that
 * hold no piece or the destination. High dead space means the puzzle huddles in
 * one region and wastes the board (cf. the `kim` anchor).
 */
export function deadSpace(board: Board, solutions: Move[][]): number {
  const cells = COLS * ROWS;
  return (cells - visitedCells(board, solutions).size) / cells;
}

// ── Search-space metrics ─────────────────────────────────────────────────
// Measure the solver's exploration structure `(result) => number`, reaching
// beyond the winning paths into the DAG and its per-depth state counts.

/**
 * First-move precision — `1 / (distinct optimal first moves)`. 1 when the opening
 * is forced; smaller when many first moves stay on an optimal path. Reads the
 * distinct optimal openings straight off the search DAG (pre-dedup).
 */
export function firstMovePrecision(result: SolverResult): number {
  const distinct = optimalFirstMoves(result.dag).length;
  return distinct === 0 ? 0 : 1 / distinct;
}

/**
 * Search profile — the fraction of BFS states first reached in the last third of
 * the depth range (from `statesPerDepth`). Higher means the difficulty is
 * back-loaded — most of the tree fans out near the solution depth.
 */
export function searchProfile(result: SolverResult): number {
  const { statesPerDepth } = result;
  let total = 0;
  for (const n of statesPerDepth) total += n;
  if (total === 0) return 0;

  const start = Math.ceil((statesPerDepth.length * 2) / 3);
  let lastThird = 0;
  for (let i = start; i < statesPerDepth.length; i++) {
    lastThird += statesPerDepth[i];
  }
  return lastThird / total;
}

/**
 * All puzzle metrics for a board, grouped by the data each acts on. Single-
 * solution metrics are reduced across the distinct solutions (max, or min for the
 * negatives); multiple-solution and search-space metrics are computed once.
 */
export type Metrics = {
  // single solution
  setupRatio: number;
  coverage: number;
  deception: number;
  reversals: number;
  crossTrailOverlap: number;
  totalDistance: number;
  pieceUsage: number;
  stopWeighted: number;
  pointlessClearance: number;
  sameDirectionRepeat: number;
  // multiple solutions
  uniqueSolutions: number;
  wallUtilization: number;
  deadSpace: number;
  // search space
  firstMovePrecision: number;
  searchProfile: number;
};

/**
 * Computes every metric for a board from its exhaustive solve. Enumerates the
 * DAG's optimal solutions and dedupes them to distinct solutions. Single-solution
 * metrics are reduced across those (max for signals, min for the two penalties);
 * multiple-solution and search-space metrics are computed once.
 */
export function computeMetrics(board: Board, result: SolverResult): Metrics {
  const solutions = deduplicateSolutions(enumerateSolutions(result.dag));

  const maxOver = (metric: (board: Board, moves: Move[]) => number): number => {
    let best = 0;
    for (const moves of solutions) best = Math.max(best, metric(board, moves));
    return best;
  };
  const minOver = (metric: (board: Board, moves: Move[]) => number): number => {
    if (solutions.length === 0) return 0;
    let best = Infinity;
    for (const moves of solutions) best = Math.min(best, metric(board, moves));
    return best;
  };

  return {
    // single solution
    setupRatio: maxOver(setupRatio),
    coverage: maxOver(coverage),
    deception: maxOver(deception),
    reversals: maxOver(reversals),
    crossTrailOverlap: maxOver(crossTrailOverlap),
    totalDistance: maxOver(totalDistance),
    pieceUsage: maxOver(pieceUsage),
    stopWeighted: maxOver(stopWeighted),
    pointlessClearance: minOver(pointlessClearance),
    sameDirectionRepeat: minOver(sameDirectionRepeat),
    // multiple solutions
    uniqueSolutions: uniqueSolutions(board, solutions),
    wallUtilization: wallUtilization(board, solutions),
    deadSpace: deadSpace(board, solutions),
    // search space
    firstMovePrecision: firstMovePrecision(result),
    searchProfile: searchProfile(result),
  };
}

export type GateResult = {
  passed: boolean;
  failedGate?: "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8";
};

/** Inclusive minMoves band per difficulty. `ultra` is excluded from generation. */
const DIFFICULTY_BANDS: Partial<Record<Difficulty, [number, number]>> = {
  easy: [5, 6],
  medium: [7, 9],
  hard: [10, 13],
};

/**
 * G6 length gate: every route must travel at least `minMoves * LENGTH_FACTOR`
 * cells. A deliberately conservative floor — it rejects only genuinely cramped,
 * short-slide boards and leaves good/varied puzzles well clear (their worst route
 * may be legitimately shorter). Tunable.
 */
const LENGTH_FACTOR = 2;

/**
 * G7 economy gate: at least this fraction of interior walls must stop a piece in
 * some solution. Deliberately loose — walls can legitimately shape reachability
 * without being an optimal-move stop cause (see `wallUtilization`). Tunable.
 */
const MIN_WALL_UTILIZATION = 0.2;

/**
 * G8 economy gate: at most this fraction of the board may be dead — cells no
 * trail enters that hold no piece or destination. Equivalently a 20% *live*
 * floor (mirrors G7's 0.2). Very conservative: the hand-built corpus runs
 * 0.44–0.81 dead, so this rejects only boards that touch under a fifth of the
 * grid. A placeholder until scores are surfaced in the generator for tuning.
 */
const MAX_DEAD_SPACE = 0.8;

/** Whether a blocker (by initial-piece id) is used in a solution — moves or stops. */
function usedBlockerIds(board: Board, moves: Move[]): Set<number> {
  const used = new Set<number>();
  for (const a of analyzeMoves(board, moves)) {
    if (board.pieces[a.moverId].type === "blocker") used.add(a.moverId);
    if (
      a.cause === "piece" && a.stoppingId !== null &&
      board.pieces[a.stoppingId].type === "blocker"
    ) used.add(a.stoppingId);
  }
  return used;
}

/**
 * Runs the acceptance gates, cheapest-first, short-circuiting on the first fail:
 *  - G1 solvable within maxDepth 15
 *  - G2 minMoves inside the difficulty band (`ultra` has none → always fails)
 *  - G3 canonical hash not already in the corpus or this batch
 *  - G4 every optimal solution moves at least one blocker (blockers matter)
 *  - G5 at most two blockers go entirely unused across all solutions
 *  - G6 every route travels >= minMoves * LENGTH_FACTOR cells (not cramped/trivial)
 *  - G7 >= MIN_WALL_UTILIZATION of walls stop a piece (no decorative clutter)
 *  - G8 dead space <= MAX_DEAD_SPACE (action doesn't huddle in one corner)
 *
 * G7–G8 gate on board *economy* — clutter and wasted space — but, like G1–G6,
 * are measured across the puzzle's solutions (which cells trails enter, which
 * walls actually stop a piece), not from the static layout alone. All gates are
 * hard rejects during generation, but do not constrain manual editing — a human
 * curator may knowingly hand-craft a board that fails a gate.
 */
export function checkGates(
  board: Board,
  options: {
    difficulty: Difficulty;
    corpus: Set<string>;
    batchHashes: Set<string>;
    /**
     * BFS state budget for the gate solve. The generation loop passes a tight
     * cap so pathologically branchy candidates reject fast (G1) instead of
     * blocking the loop for seconds; omitted elsewhere for the full solver limit.
     */
    maxStates?: number;
  },
): GateResult {
  let result: SolverResult;
  try {
    result = solveExhaustiveSync(board, {
      maxDepth: 15,
      maxStates: options.maxStates,
    });
  } catch {
    return { passed: false, failedGate: "G1" };
  }

  const band = DIFFICULTY_BANDS[options.difficulty];
  if (!band || result.minMoves < band[0] || result.minMoves > band[1]) {
    return { passed: false, failedGate: "G2" };
  }

  const hash = boardCanonicalHash(board);
  if (options.corpus.has(hash) || options.batchHashes.has(hash)) {
    return { passed: false, failedGate: "G3" };
  }

  const solutions = deduplicateSolutions(enumerateSolutions(result.dag));

  const everyUsesBlocker = solutions.every((moves) =>
    moveRoles(board, moves).some((r) => r === "blocker")
  );
  if (!everyUsesBlocker) return { passed: false, failedGate: "G4" };

  const used = new Set<number>();
  for (const moves of solutions) {
    for (const id of usedBlockerIds(board, moves)) used.add(id);
  }
  const unused = board.pieces
    .filter((p, i) => p.type === "blocker" && !used.has(i))
    .length;
  if (unused > 2) return { passed: false, failedGate: "G5" };

  let minTravel = Infinity;
  for (const moves of solutions) {
    minTravel = Math.min(minTravel, totalDistance(board, moves));
  }
  if (minTravel < result.minMoves * LENGTH_FACTOR) {
    return { passed: false, failedGate: "G6" };
  }

  if (wallUtilization(board, solutions) < MIN_WALL_UTILIZATION) {
    return { passed: false, failedGate: "G7" };
  }

  if (deadSpace(board, solutions) > MAX_DEAD_SPACE) {
    return { passed: false, failedGate: "G8" };
  }

  return { passed: true };
}

/** A single distinct solution with its own metrics and composite score. */
export type SolutionScore = { moves: Move[]; metrics: Metrics; score: number };

export type ScoredBoard = {
  score: number; // headline aggregate — the mean route score
  mean: number;
  min: number; // worst route — the outlier detector for curation filters
  stddev: number;
  perSolution: SolutionScore[];
};

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const bounded = (value: number, max: number): number =>
  max > 0 ? clamp01(value / max) : 0;

/** Context a bound may depend on (some metrics scale with move/piece count). */
type BoundCtx = { minMoves: number; blockers: number };
type Bound = (ctx: BoundCtx) => number;

/**
 * Score calibration — the per-metric max bounds the composite normalizes against,
 * split into positive and negative terms. This is the single tunable source of
 * truth; bump `version` on every change so a corpus report is traceable to the
 * calibration that produced it (see `scoring/reports/calibration-<version>.md`).
 *
 * v1 used theoretical maxes and came out *anti-correlated* with human judgement
 * — both the corpus anchors (erik > torstein > kim > malene) and the first
 * labeled generated set (a 2★ board scored top, a 5★ board bottom) inverted.
 *
 * v2 is a deliberately conservative structural correction — only changes both
 * datasets independently support, no fitted constants (the labeled set is still
 * small):
 *  - dropped `firstMovePrecision` (rewarded forced openings — the "too-easy"
 *    profile; "nice" boards averaged 0.19, "too-easy" 0.39);
 *  - added `wallUtilization` as a positive and `deadSpace` as a negative (the
 *    two strongest human-aligned signals; previously gate/advisory only);
 *  - added a shaped `variety` term over distinct solutions (see
 *    {@link varietyScore}) — many routes is good only up to a point.
 */
export const CALIBRATION: {
  version: number;
  positive: Record<string, Bound>;
  negative: Record<string, Bound>;
} = {
  version: 2,
  positive: {
    setupRatio: () => 1,
    pieceUsage: ({ minMoves: m, blockers: p }) =>
      p * Math.log2(1 + m) + Math.log2(1 + p),
    deception: ({ minMoves: m }) => 7 * m,
    reversals: ({ minMoves: m }) => Math.max(1, m - 1),
    crossTrailOverlap: () => COLS * ROWS,
    totalDistance: ({ minMoves: m }) => 7 * m * 2,
    searchProfile: () => 1,
    coverage: () => 1,
    stopWeighted: ({ minMoves: m }) => 3 * m,
    wallUtilization: () => 1,
    variety: () => 1,
  },
  negative: {
    pointlessClearance: ({ minMoves: m }) => Math.max(1, m),
    sameDirectionRepeat: () => COLS * ROWS,
    deadSpace: () => 1,
  },
};

/**
 * Shaped variety term over the distinct-solution count, in [0, 1]. Quality is
 * not monotonic in route count (labeled data): 2–8 varied routes is the sweet
 * band ("wow, you could also solve it like *that*"), a single route is neutral
 * — it can be brilliant (torstein) or linear (the too-easy profile); the count
 * alone can't tell, other terms must — and double-digit counts fade toward 0
 * (a 49-route board rated "too-easy": when everything works, nothing is
 * clever). The fade is gentle (zero at 32) because canonicalization currently
 * over-counts some varied boards (malene: 20 counted, 4 by human count).
 */
export function varietyScore(uniqueSolutions: number): number {
  if (uniqueSolutions <= 1) return 0.5;
  if (uniqueSolutions <= 8) return 1;
  return Math.max(0, 1 - (uniqueSolutions - 8) / 24);
}

/**
 * Composite quality score for a single route in `[-1, 1]`. Each metric is divided
 * by its `CALIBRATION` max so it lands in `[0,1]`, then positives are averaged and
 * the two negatives subtracted — equal footing, no metric dominating by range.
 */
function compositeScore(
  metrics: Metrics,
  board: Board,
  minMoves: number,
): number {
  const ctx: BoundCtx = {
    minMoves,
    blockers: board.pieces.filter((piece) => piece.type === "blocker").length,
  };
  const values: Record<string, number> = {
    setupRatio: metrics.setupRatio,
    pieceUsage: metrics.pieceUsage,
    deception: metrics.deception,
    reversals: metrics.reversals,
    crossTrailOverlap: metrics.crossTrailOverlap,
    totalDistance: metrics.totalDistance,
    searchProfile: metrics.searchProfile,
    coverage: metrics.coverage,
    stopWeighted: metrics.stopWeighted,
    wallUtilization: metrics.wallUtilization,
    variety: varietyScore(metrics.uniqueSolutions),
    pointlessClearance: metrics.pointlessClearance,
    sameDirectionRepeat: metrics.sameDirectionRepeat,
    deadSpace: metrics.deadSpace,
  };

  const mean = (terms: Record<string, Bound>) => {
    const keys = Object.keys(terms);
    if (keys.length === 0) return 0;
    let sum = 0;
    for (const k of keys) sum += bounded(values[k], terms[k](ctx));
    return sum / keys.length;
  };

  return mean(CALIBRATION.positive) - mean(CALIBRATION.negative);
}

/**
 * Full metrics for a single route: its single-solution metrics plus the shared
 * board-level metrics (multiple-solution + search-space) that are constant across
 * every route of the board.
 */
function routeMetrics(
  board: Board,
  route: Move[],
  shared: Pick<
    Metrics,
    | "uniqueSolutions"
    | "wallUtilization"
    | "deadSpace"
    | "firstMovePrecision"
    | "searchProfile"
  >,
): Metrics {
  return {
    setupRatio: setupRatio(board, route),
    coverage: coverage(board, route),
    deception: deception(board, route),
    reversals: reversals(board, route),
    crossTrailOverlap: crossTrailOverlap(board, route),
    totalDistance: totalDistance(board, route),
    pieceUsage: pieceUsage(board, route),
    stopWeighted: stopWeighted(board, route),
    pointlessClearance: pointlessClearance(board, route),
    sameDirectionRepeat: sameDirectionRepeat(board, route),
    ...shared,
  };
}

/**
 * Scores a board by scoring each distinct (canonical) solution on its own, then
 * aggregating. `score` is the mean route score; `min`/`stddev`/`perSolution` are
 * carried along so curation can reason about outliers — e.g. reject a board whose
 * worst route falls below a threshold — instead of one strong route masking a
 * weak one inside a pre-aggregated metric set.
 */
export function scoreBoard(board: Board, result: SolverResult): ScoredBoard {
  const routes = deduplicateSolutions(enumerateSolutions(result.dag));
  const shared = {
    uniqueSolutions: uniqueSolutions(board, routes),
    wallUtilization: wallUtilization(board, routes),
    deadSpace: deadSpace(board, routes),
    firstMovePrecision: firstMovePrecision(result),
    searchProfile: searchProfile(result),
  };

  const perSolution: SolutionScore[] = [];
  for (const route of routes) {
    const metrics = routeMetrics(board, route, shared);
    perSolution.push({
      moves: route,
      metrics,
      score: compositeScore(metrics, board, result.minMoves),
    });
  }

  let sum = 0;
  for (const s of perSolution) sum += s.score;
  const mean = sum / perSolution.length;

  let variance = 0;
  for (const s of perSolution) variance += (s.score - mean) ** 2;
  variance /= perSolution.length;

  let min = Infinity;
  for (const s of perSolution) min = Math.min(min, s.score);

  return {
    score: mean,
    mean,
    min,
    stddev: Math.sqrt(variance),
    perSolution,
  };
}
