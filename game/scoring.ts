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

/**
 * Setup ratio — fraction of moves that reposition a blocker rather than the puck,
 * maxed across the distinct solutions (more setup ⇒ harder).
 */
export function setupRatio(board: Board, solutions: Move[][]): number {
  return Math.max(
    0,
    ...solutions.map((moves) =>
      moves.length === 0
        ? 0
        : moveRoles(board, moves).filter((r) => r === "blocker").length /
          moves.length
    ),
  );
}

/**
 * Coverage — distinct cells the puck sweeps, as a fraction of the 64-cell board,
 * maxed across the distinct solutions.
 */
export function coverage(board: Board, solutions: Move[][]): number {
  return Math.max(
    0,
    ...computeTrails(board, solutions).map((trail) =>
      new Set(
        trail.filter((c) => c.pieceRole === "puck").map((c) => c.pos),
      ).size / (COLS * ROWS)
    ),
  );
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
 * Total slide distance per role, from the solution with the greatest combined
 * travel. Manhattan distance summed over moves, split into puck vs blocker.
 */
export function totalDistance(
  board: Board,
  solutions: Move[][],
): { puck: number; blocker: number } {
  let best = { puck: 0, blocker: 0 };
  for (const moves of solutions) {
    const roles = moveRoles(board, moves);
    const d = { puck: 0, blocker: 0 };
    moves.forEach(([from, to], i) => {
      const dist = Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
      if (roles[i] === "puck") d.puck += dist;
      else d.blocker += dist;
    });
    if (d.puck + d.blocker > best.puck + best.blocker) best = d;
  }
  return best;
}

/**
 * Deception — how far the puck slides *away* from the destination, summed over a
 * solution's puck moves (per-axis, net non-negative). Pure geometry; maxed across
 * the distinct solutions. This is what actually misleads a human solver.
 */
export function deception(board: Board, solutions: Move[][]): number {
  const d = board.destination;
  return Math.max(
    0,
    ...solutions.map((moves) => {
      const roles = moveRoles(board, moves);
      let sum = 0;
      moves.forEach(([from, to], i) => {
        if (roles[i] !== "puck") return;
        const onX = from.y === to.y;
        const before = onX ? Math.abs(from.x - d.x) : Math.abs(from.y - d.y);
        const after = onX ? Math.abs(to.x - d.x) : Math.abs(to.y - d.y);
        sum += Math.max(0, after - before);
      });
      return sum;
    }),
  );
}

/**
 * Reversals — consecutive moves of the *same* piece in opposite directions
 * (other pieces may move in between). Maxed across the distinct solutions.
 */
export function reversals(board: Board, solutions: Move[][]): number {
  return Math.max(
    0,
    ...solutions.map((moves) => {
      const ids = movePieceIds(board, moves);
      const dirs = new Map<number, Direction[]>();
      moves.forEach(([from, to], i) => {
        const list = dirs.get(ids[i]) ?? [];
        list.push(moveDirection(from, to));
        dirs.set(ids[i], list);
      });
      let count = 0;
      for (const list of dirs.values()) {
        for (let k = 1; k < list.length; k++) {
          if (OPPOSITE[list[k - 1]] === list[k]) count++;
        }
      }
      return count;
    }),
  );
}

/**
 * Cross-trail overlap — cells swept by two or more *different* pieces (a piece
 * crossing another's path). Self-overlap is excluded. Maxed across solutions.
 */
export function crossTrailOverlap(board: Board, solutions: Move[][]): number {
  return Math.max(
    0,
    ...solutions.map((moves) => {
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
    }),
  );
}

/**
 * Search profile — the fraction of BFS states first reached in the last third of
 * the depth range (from `statesPerDepth`). Higher means the difficulty is
 * back-loaded — most of the tree fans out near the solution depth.
 */
export function searchProfile(statesPerDepth: number[]): number {
  const total = statesPerDepth.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  const start = Math.ceil((statesPerDepth.length * 2) / 3);
  const lastThird = statesPerDepth.slice(start).reduce((a, b) => a + b, 0);
  return lastThird / total;
}

/**
 * First-move precision — `1 / (distinct optimal first moves)`. 1 when the opening
 * is forced; smaller when many first moves stay on an optimal path. Feed the count
 * from `optimalFirstMoves(dag)`.
 */
export function firstMovePrecision(distinctFirstMoves: number): number {
  return distinctFirstMoves === 0 ? 0 : 1 / distinctFirstMoves;
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
  board.pieces.forEach((p, i) => posToId.set(posOf(p), i));

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

const minAcross = (values: number[]): number =>
  values.length === 0 ? 0 : Math.min(...values);

export type StopTypes = {
  edge: number;
  wall: number;
  piece: number;
  blockerOnPuck: number;
};

/**
 * Stop causes across a solution's moves — how each slide ends (board edge, wall,
 * or another piece), with `blockerOnPuck` sub-counting blocker slides halted by
 * the puck. Returns the counts from the solution with the most "interesting"
 * stops (piece > wall > edge).
 */
export function stopTypes(board: Board, solutions: Move[][]): StopTypes {
  let best: StopTypes = { edge: 0, wall: 0, piece: 0, blockerOnPuck: 0 };
  let bestScore = -1;
  for (const moves of solutions) {
    const counts: StopTypes = { edge: 0, wall: 0, piece: 0, blockerOnPuck: 0 };
    for (const a of analyzeMoves(board, moves)) {
      counts[a.cause]++;
      if (
        a.cause === "piece" &&
        board.pieces[a.moverId].type === "blocker" &&
        a.stoppingId !== null && board.pieces[a.stoppingId].type === "puck"
      ) counts.blockerOnPuck++;
    }
    const score = counts.piece * 3 + counts.wall * 2 + counts.edge;
    if (score > bestScore) {
      bestScore = score;
      best = counts;
    }
  }
  return best;
}

/**
 * Piece usage — `Σ_p log2(1 + uses(p)) + log2(1 + U)` over non-puck pieces, where
 * `uses(p)` counts moves in which blocker `p` moves or is the stopping piece, and
 * `U` is how many blockers are used at all. Maxed across the distinct solutions.
 */
export function pieceUsage(board: Board, solutions: Move[][]): number {
  const blockerIds = board.pieces
    .map((p, i) => (p.type === "blocker" ? i : -1))
    .filter((i) => i >= 0);

  return Math.max(
    0,
    ...solutions.map((moves) => {
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
    }),
  );
}

/**
 * Pointless clearance (N1, negative) — blocker moves after which that blocker
 * never interacts again (never moves, never stops another piece). Per occurrence;
 * minimized across solutions (the cleanest route defines the board).
 */
export function pointlessClearance(board: Board, solutions: Move[][]): number {
  return minAcross(solutions.map((moves) => {
    const analysis = analyzeMoves(board, moves);
    let count = 0;
    analysis.forEach((a, i) => {
      if (board.pieces[a.moverId].type !== "blocker") return;
      const interactsLater = analysis.slice(i + 1).some((later) =>
        later.moverId === a.moverId || later.stoppingId === a.moverId
      );
      if (!interactsLater) count++;
    });
    return count;
  }));
}

/**
 * Same-direction repeat (N2, negative) — cells a single piece re-traverses in the
 * same direction. Per extra traversal; minimized across solutions.
 */
export function sameDirectionRepeat(board: Board, solutions: Move[][]): number {
  return minAcross(solutions.map((moves) => {
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
  }));
}

/** All puzzle metrics for a board, aggregated over its distinct solutions. */
export type Metrics = {
  setupRatio: number;
  pieceUsage: number;
  deception: number;
  reversals: number;
  crossTrailOverlap: number;
  totalDistance: { puck: number; blocker: number };
  uniqueSolutions: number;
  firstMovePrecision: number;
  searchProfile: number;
  coverage: number;
  stopTypes: StopTypes;
  pointlessClearance: number;
  sameDirectionRepeat: number;
};

/**
 * Computes every metric for a board from its exhaustive solve. Enumerates the
 * DAG's optimal solutions, dedupes them to distinct solutions, and measures over
 * those — except `firstMovePrecision` (distinct optimal openings, pre-dedup, off
 * the DAG) and `searchProfile` (from `statesPerDepth`).
 */
export function computeMetrics(board: Board, result: SolverResult): Metrics {
  const solutions = deduplicateSolutions(enumerateSolutions(result.dag));

  return {
    setupRatio: setupRatio(board, solutions),
    pieceUsage: pieceUsage(board, solutions),
    deception: deception(board, solutions),
    reversals: reversals(board, solutions),
    crossTrailOverlap: crossTrailOverlap(board, solutions),
    totalDistance: totalDistance(board, solutions),
    uniqueSolutions: solutions.length,
    firstMovePrecision: firstMovePrecision(
      optimalFirstMoves(result.dag).length,
    ),
    searchProfile: searchProfile(result.statesPerDepth),
    coverage: coverage(board, solutions),
    stopTypes: stopTypes(board, solutions),
    pointlessClearance: pointlessClearance(board, solutions),
    sameDirectionRepeat: sameDirectionRepeat(board, solutions),
  };
}

export type GateResult = {
  passed: boolean;
  failedGate?: "G1" | "G2" | "G3" | "G4" | "G5";
};

/** Inclusive minMoves band per difficulty. `ultra` is excluded from generation. */
const DIFFICULTY_BANDS: Partial<Record<Difficulty, [number, number]>> = {
  easy: [4, 7],
  medium: [6, 9],
  hard: [9, 13],
};

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
 */
export function checkGates(
  board: Board,
  options: {
    difficulty: Difficulty;
    corpus: Set<string>;
    batchHashes: Set<string>;
  },
): GateResult {
  let result: SolverResult;
  try {
    result = solveExhaustiveSync(board, { maxDepth: 15 });
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

/**
 * Composite quality score for a single route in `[-1, 1]`. Each metric is divided
 * by a deterministic per-board max so it lands in `[0,1]`, then positives are
 * averaged and the two negatives subtracted — equal footing, no metric dominating
 * by range or count.
 *
 * TODO(tuning): the max bounds and equal weights are a provisional v1; tune once
 * there is a scored corpus to calibrate against.
 */
function compositeScore(
  metrics: Metrics,
  board: Board,
  minMoves: number,
): number {
  const m = minMoves;
  const p = board.pieces.filter((piece) => piece.type === "blocker").length;
  const stopWeighted = metrics.stopTypes.piece * 3 +
    metrics.stopTypes.wall * 2 +
    metrics.stopTypes.edge;

  const positives = [
    bounded(metrics.setupRatio, 1),
    bounded(metrics.pieceUsage, p * Math.log2(1 + m) + Math.log2(1 + p)),
    bounded(metrics.deception, 7 * m),
    bounded(metrics.reversals, Math.max(1, m - 1)),
    bounded(metrics.crossTrailOverlap, COLS * ROWS),
    bounded(
      metrics.totalDistance.puck + metrics.totalDistance.blocker,
      7 * m * 2,
    ),
    bounded(metrics.firstMovePrecision, 1),
    bounded(metrics.searchProfile, 1),
    bounded(metrics.coverage, 1),
    bounded(stopWeighted, 3 * m),
  ];
  const negatives = [
    bounded(metrics.pointlessClearance, Math.max(1, m)),
    bounded(metrics.sameDirectionRepeat, COLS * ROWS),
  ];

  const positive = positives.reduce((a, b) => a + b, 0) / positives.length;
  const negative = negatives.reduce((a, b) => a + b, 0) / negatives.length;
  return positive - negative;
}

/**
 * Full metrics for a single route: its per-solution metrics (each metric called
 * with just this route) plus the shared board-level metrics (`uniqueSolutions`,
 * `firstMovePrecision`, `searchProfile`), which are constant across routes.
 */
function routeMetrics(
  board: Board,
  route: Move[],
  shared: Pick<
    Metrics,
    "uniqueSolutions" | "firstMovePrecision" | "searchProfile"
  >,
): Metrics {
  const one = [route];
  return {
    setupRatio: setupRatio(board, one),
    pieceUsage: pieceUsage(board, one),
    deception: deception(board, one),
    reversals: reversals(board, one),
    crossTrailOverlap: crossTrailOverlap(board, one),
    totalDistance: totalDistance(board, one),
    coverage: coverage(board, one),
    stopTypes: stopTypes(board, one),
    pointlessClearance: pointlessClearance(board, one),
    sameDirectionRepeat: sameDirectionRepeat(board, one),
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
    uniqueSolutions: routes.length,
    firstMovePrecision: firstMovePrecision(
      optimalFirstMoves(result.dag).length,
    ),
    searchProfile: searchProfile(result.statesPerDepth),
  };

  const perSolution: SolutionScore[] = routes.map((route) => {
    const metrics = routeMetrics(board, route, shared);
    return {
      moves: route,
      metrics,
      score: compositeScore(metrics, board, result.minMoves),
    };
  });

  const scores = perSolution.map((s) => s.score);
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, s) => a + (s - mean) ** 2, 0) /
    scores.length;

  return {
    score: mean,
    mean,
    min: Math.min(...scores),
    stddev: Math.sqrt(variance),
    perSolution,
  };
}
