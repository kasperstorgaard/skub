import {
  COLS,
  encodeBoard,
  flipBoard,
  getMoveSlide,
  isPositionSame,
  resolveMoves,
  rotateBoard,
  ROWS,
} from "#/game/board.ts";
import {
  enumerateSolutions,
  firstSolutionFrom,
  optimalFirstMoves,
  solveExhaustiveSync,
  type SolverResult,
} from "#/game/solver.ts";
import { encodeMove, getCanonicalMoveKey } from "#/game/strings.ts";
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

/**
 * The trail of each solution: for every move, the cells it sweeps tagged with the
 * moving piece's role, the slide direction, and the move index. Trails drive
 * overlap, coverage, and canonicalization.
 *
 * The cells come from the slide itself rather than being interpolated between
 * the endpoints, because a slide through a portal ends off its own axis.
 */
export function computeTrails(
  board: Board,
  solutions: Move[][],
): TrailCell[][] {
  return solutions.map((moves) => {
    const trail: TrailCell[] = [];
    let current = board;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const [from] = move;
      const slide = getMoveSlide(move, current);
      const piece = current.pieces.find((item) => isPositionSame(item, from));

      if (!slide || !piece) {
        throw new Error(`Solution move ${i} is not playable`);
      }

      // Portals keep momentum, so every leg travels the same way.
      const [firstLeg] = slide.segments;
      const direction = moveDirection(firstLeg[0], firstLeg[1]);

      for (const leg of slide.segments) {
        for (const pos of leg) {
          trail.push({
            pos: posOf(pos),
            pieceRole: piece.type,
            direction,
            moveIndex: i,
          });
        }
      }

      current = resolveMoves(current, [move]);
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
  cause: "edge" | "wall" | "piece" | "hole" | "portal";
  stoppingId: number | null;
};

/**
 * Per-move analysis of a solution: which piece moved (`moverId`, a stable index
 * into the initial pieces), why the slide stopped, and — for piece stops — which
 * piece stopped it (`stoppingId`).
 *
 * A slide that ends on a hole or a portal is attributed to that cell rather than
 * to whatever lies one step beyond it, because a portal stop is decided across
 * the board from where the piece came to rest. Boards carrying neither analyse
 * exactly as they did before.
 */
function analyzeMoves(board: Board, moves: Move[]): MoveAnalysis[] {
  const posToId = new Map<number, number>();
  for (let i = 0; i < board.pieces.length; i++) {
    posToId.set(posOf(board.pieces[i]), i);
  }

  let current = board;

  return moves.map((move) => {
    const [from, to] = move;
    const moverId = posToId.get(posOf(from));
    const slide = getMoveSlide(move, current);

    if (moverId == null || !slide) {
      throw new Error(`Solution move ${encodeMove(move)} is not playable`);
    }

    const [firstLeg] = slide.segments;
    const direction = moveDirection(firstLeg[0], firstLeg[1]);
    const beyond = beyondCell(to, direction);

    let cause: MoveAnalysis["cause"] = "edge";
    let stoppingId: number | null = null;

    if (slide.outcome === "dropped") {
      cause = "hole";
    } else if (current.portals.some((portal) => isPositionSame(portal, to))) {
      cause = "portal";
    } else if (inBounds(beyond)) {
      if (wallBeyond(current.walls, to, direction)) cause = "wall";
      else if (posToId.has(posOf(beyond))) {
        cause = "piece";
        stoppingId = posToId.get(posOf(beyond)) ?? null;
      }
    }

    posToId.delete(posOf(from));
    if (slide.outcome !== "dropped") posToId.set(posOf(to), moverId);

    current = resolveMoves(current, [move]);
    return { moverId, cause, stoppingId };
  });
}

/**
 * Stop weight — how a solution's slides end, scored
 * `(piece|hole|portal)×3 + wall×2 + edge`. Stops you have to arrange are the
 * most interesting to solve around, edges the least; a hole or a portal takes
 * the same weight as a piece, since both have to be set up deliberately.
 */
export function stopWeighted(board: Board, moves: Move[]): number {
  let edge = 0;
  let wall = 0;
  let arranged = 0;

  for (const a of analyzeMoves(board, moves)) {
    if (a.cause === "edge") edge++;
    else if (a.cause === "wall") wall++;
    else arranged++;
  }

  return arranged * 3 + wall * 2 + edge;
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

/**
 * The puck's trajectory through a solution as a stable key — the puck's moves in
 * order, blocker moves ignored. Two solutions with the same key send the puck
 * along the same path and differ only in how the setup is shuffled.
 */
function puckPathKey(board: Board, moves: Move[]): string {
  const roles = moveRoles(board, moves);
  return moves
    .filter((_, i) => roles[i] === "puck")
    .map(([from, to]) => `${posOf(from)}>${posOf(to)}`)
    .join(",");
}

/**
 * Puck-path variety — distinct puck trajectories as a fraction of the distinct
 * solutions. 1 means every solution moves the puck differently; 0.5 means half
 * the "alternative" routes are the same puck path with the blocker setup
 * reshuffled, which reads to a solver as one puzzle rather than two (the `birk`
 * profile: two 9-move solutions, both moving the puck exactly twice, identically).
 * Vacuously 1 for a single-solution board — with nothing to compare, this says
 * nothing about quality.
 */
export function puckPathVariety(board: Board, solutions: Move[][]): number {
  if (solutions.length === 0) return 0;
  const paths = new Set(solutions.map((moves) => puckPathKey(board, moves)));
  return paths.size / solutions.length;
}

/**
 * Opening setup — how many moves pass before the puck first moves. 0 means the
 * puck opens; higher means the solver must shuffle blockers before the piece
 * they care about does anything, which curation reads as "the puzzle hasn't
 * started yet" (occasionally the point, mostly padding — see the `henrik` note).
 */
export function openingSetup(board: Board, moves: Move[]): number {
  return moveRoles(board, moves).indexOf("puck");
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
 * one region and wastes the board (cf. the `kim` board).
 */
export function deadSpace(board: Board, solutions: Move[][]): number {
  const cells = COLS * ROWS;
  return (cells - visitedCells(board, solutions).size) / cells;
}

// ── Static-layout metrics ────────────────────────────────────────────────

/** Chebyshev (chessboard) distance between two positions. */
const chebyshev = (a: Position, b: Position): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/**
 * Clumping — the fraction of same-kind structure pairs (wall–wall,
 * blocker–blocker) within Chebyshev distance 1 of each other, pooled across
 * both kinds. High clumping means the board's structure piles up in tight
 * knots instead of spreading out — "clumped" is the most common human
 * complaint tag with no metric behind it. Advisory for now (not in the
 * composite, not gated) until its correlation with ratings is established.
 * 0 when no kind has two members.
 */
export function clumping(board: Board): number {
  const groups: Position[][] = [
    board.walls,
    board.pieces.filter((piece) => piece.type === "blocker"),
  ];
  let close = 0;
  let total = 0;
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        total++;
        if (chebyshev(group[i], group[j]) <= 1) close++;
      }
    }
  }
  return total === 0 ? 0 : close / total;
}

/** Cells a wall touches: it sits on an edge, so it borders two of them. */
function wallCells({ x, y, orientation }: Wall): Position[] {
  return orientation === "vertical"
    ? [{ x, y }, { x: x - 1, y }]
    : [{ x, y }, { x, y: y - 1 }];
}

/**
 * Empty region — the largest connected run of cells with nothing in or against
 * them (no piece, no destination, no wall on any side), as a fraction of the
 * board.
 *
 * Aimed at the `empty-areas` complaint, the second most common in the curation
 * set. `deadSpace` is the closest existing metric but measures something else:
 * cells no *trail* enters, which is play-derived and counts a busy corner of the
 * layout as dead if no solution happens to cross it. The complaint is about the
 * board you see before moving anything — a quarter of the grid with nothing in
 * it. Advisory (not in the composite, not gated) until it earns a rating
 * correlation.
 */
export function emptyRegion(board: Board): number {
  const cells = COLS * ROWS;
  const index = (x: number, y: number) => y * COLS + x;
  const structured = new Uint8Array(cells);

  for (const piece of board.pieces) structured[index(piece.x, piece.y)] = 1;
  structured[index(board.destination.x, board.destination.y)] = 1;
  for (const wall of board.walls) {
    for (const { x, y } of wallCells(wall)) {
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) structured[index(x, y)] = 1;
    }
  }

  const seen = new Uint8Array(cells);
  let largest = 0;

  for (let start = 0; start < cells; start++) {
    if (structured[start] || seen[start]) continue;

    let size = 0;
    const queue = [start];
    seen[start] = 1;

    while (queue.length) {
      const current = queue.pop()!;
      size++;
      const x = current % COLS;
      const y = (current - x) / COLS;
      const neighbours = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
        const next = index(nx, ny);
        if (structured[next] || seen[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }

    largest = Math.max(largest, size);
  }

  return largest / cells;
}

/**
 * Wall symmetry — the share of walls that have a mirror partner, taken across
 * the better of the two centre axes. 1 means the wall layout mirrors exactly,
 * 0 that no wall has a counterpart.
 *
 * Aimed at `pretty`, the one board-level judgement with no metric behind it at
 * all. `boardSelfSymmetries()` only recognises boards that are *exactly*
 * invariant, which the generator's probabilistic symmetry knob almost never
 * produces; this is the graded version, and near-symmetry is what the eye
 * actually rewards. Advisory, like `emptyRegion`. Vacuously 1 for a board with
 * no walls — nothing is out of place.
 */
export function wallSymmetry(board: Board): number {
  if (board.walls.length === 0) return 1;

  const key = (wall: Wall) => `${wall.x},${wall.y},${wall.orientation}`;
  const present = new Set(board.walls.map(key));

  let best = 0;
  for (const axis of ["horizontal", "vertical"] as const) {
    const mirrored = flipBoard(board, axis).walls;
    let matched = 0;
    for (const wall of mirrored) if (present.has(key(wall))) matched++;
    best = Math.max(best, matched / board.walls.length);
  }
  return best;
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
 * A suboptimal route is *padded* — a fake near-miss — when removing a single
 * move from it yields an optimal route's canonical move-multiset. That means the
 * route is just an optimal solution plus one inconsequential extra move (shuffle
 * a blocker, then run the optimal path), which every board has and which made
 * the old state-level `isolationGap` flat at 1 everywhere.
 */
function isPaddedOptimal(route: Move[], optimalKeys: Set<string>): boolean {
  for (let i = 0; i < route.length; i++) {
    const trimmed = route.slice(0, i).concat(route.slice(i + 1));
    if (optimalKeys.has(getCanonicalMoveKey(trimmed))) return true;
  }
  return false;
}

/**
 * Genuine near-miss isolation. Walks one route per suboptimal goal one move past
 * optimal (`nearDag`), canonical-dedupes them, and drops the *padded* ones (an
 * optimal route plus one inconsequential move). What survives are genuine
 * alternative solutions at optimal + 1.
 *
 * Returns:
 *  - `count` — distinct genuine near-misses at optimal + 1 (the "obvious
 *    solution" profile has several; a board whose next real route is far out has
 *    none).
 *  - `gap` — moves past optimal to the nearest *genuine* near-miss: 1 when any
 *    survives, else 2 (the optimal stands alone at +1 — the torstein profile:
 *    optimal 10, next distinct route 12). 0 when the solve didn't overshoot
 *    (unmeasured, not un-isolated).
 */
export function genuineNearMisses(
  result: SolverResult,
  optimalSolutions: Move[][],
): { count: number; gap: number } {
  if (result.searchedDepth <= result.minMoves) return { count: 0, gap: 0 };

  const optimalKeys = new Set(optimalSolutions.map(getCanonicalMoveKey));
  const targetLength = result.minMoves + 1;
  const seen = new Set<string>();
  let count = 0;

  for (const goal of result.nearDag.goals) {
    const route = firstSolutionFrom(result.nearDag, goal);
    if (route.length !== targetLength) continue; // only optimal + 1
    const key = getCanonicalMoveKey(route);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isPaddedOptimal(route, optimalKeys)) continue;
    count++;
  }

  return { count, gap: count > 0 ? 1 : 2 };
}

/**
 * All puzzle metrics for a board, grouped by the data each acts on. Single-
 * solution metrics are reduced across the distinct solutions (max, or min for the
 * negatives); multiple-solution, layout, and search-space metrics are computed
 * once.
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
  openingSetup: number;
  // multiple solutions
  uniqueSolutions: number;
  wallUtilization: number;
  deadSpace: number;
  puckPathVariety: number;
  // static layout
  clumping: number;
  emptyRegion: number;
  wallSymmetry: number;
  // search space
  firstMovePrecision: number;
  searchProfile: number;
  isolationGap: number;
  nearMissCount: number;
};

/**
 * Computes every metric for a board from its exhaustive solve. Enumerates the
 * DAG's optimal solutions and dedupes them to distinct solutions. Single-solution
 * metrics are reduced across those (max for signals, min for the two penalties);
 * multiple-solution and search-space metrics are computed once.
 */
export function computeMetrics(board: Board, result: SolverResult): Metrics {
  const solutions = deduplicateSolutions(enumerateSolutions(result.dag));
  const nearMiss = genuineNearMisses(result, solutions);

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
    openingSetup: minOver(openingSetup),
    // multiple solutions
    uniqueSolutions: uniqueSolutions(board, solutions),
    wallUtilization: wallUtilization(board, solutions),
    deadSpace: deadSpace(board, solutions),
    puckPathVariety: puckPathVariety(board, solutions),
    // static layout
    clumping: clumping(board),
    emptyRegion: emptyRegion(board),
    wallSymmetry: wallSymmetry(board),
    // search space
    firstMovePrecision: firstMovePrecision(result),
    searchProfile: searchProfile(result),
    isolationGap: nearMiss.gap,
    nearMissCount: nearMiss.count,
  };
}

export type GateResult = {
  passed: boolean;
  failedGate?:
    | "G1"
    | "G2"
    | "G3"
    | "G4"
    | "G5"
    | "G6"
    | "G7"
    | "G8"
    | "G9"
    | "G10";
};

/**
 * Inclusive minMoves band per difficulty. `ultra` has no band. No longer a
 * generation input — generation targets an exact move count (see
 * `MOVE_TARGETS`) and the curator labels difficulty afterwards; this is what
 * seeds the default they're offered.
 */
export const DIFFICULTY_BANDS: Partial<Record<Difficulty, [number, number]>> = {
  easy: [5, 6],
  medium: [7, 9],
  hard: [10, 13],
};

/**
 * The move counts generation targets, one picked per run. Replaces the
 * difficulty selector: the old bands made the curator commit to a difficulty
 * up front, and `hard` (10–13) was effectively ungeneratable — under 3% of
 * random boards reach 10 moves and the branchy ones time out the gate solve.
 * 6–10 is the range that produces boards at a workable rate, and what the
 * curator says about the result afterwards is the signal worth having.
 */
export const MOVE_TARGETS = [6, 7, 8, 9, 10] as const;

/**
 * The difficulty a board's move count suggests, from `DIFFICULTY_BANDS` — the
 * default the curator's post-generation difficulty control opens on. Counts
 * past the bands clamp to the nearest end.
 */
export function difficultyForMoves(minMoves: number): Difficulty {
  for (const [difficulty, [low, high]] of Object.entries(DIFFICULTY_BANDS)) {
    if (minMoves >= low && minMoves <= high) return difficulty as Difficulty;
  }
  return minMoves < 5 ? "easy" : "ultra";
}

/**
 * G9: whether any blocker is boxed in on all four sides by walls or the board
 * edge. Pieces are ignored — they can move away, walls can't. A permanently
 * immobile blocker reads as a wall wearing a blocker's costume; curation
 * flagged it as a gimmick.
 */
function hasTrappedBlocker(board: Board): boolean {
  const directions: Direction[] = ["up", "down", "left", "right"];
  return board.pieces.some((piece) =>
    piece.type === "blocker" &&
    directions.every((direction) => {
      const beyond = beyondCell(piece, direction);
      return !inBounds(beyond) || wallBeyond(board.walls, piece, direction);
    })
  );
}

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
 * Floor on the *number* of walls that must stop a piece, used by G7 for
 * wall-heavy requests. 0.2 × the default wallsRange top (15) = 3, so the fraction
 * and the count agree at the default and only diverge (looser) beyond it.
 */
const MIN_USEFUL_WALLS = 3;

/**
 * G5 unused-blocker allowance, conditional on the board's blocker count. The
 * gate's intent is "blockers should matter", but asking for a denser board
 * legitimately places more of them, so the fixed ≤2 over-rejects dense requests.
 * The allowance scales to keep at least half the blockers in use: fixed 2 for the
 * default counts (≤5), then 6→3, 8→4, … Conservative — never below 2, so it only
 * ever loosens.
 */
export function maxUnusedBlockers(blockerCount: number): number {
  return Math.max(2, Math.floor(blockerCount / 2));
}

/**
 * G7 wall-utilization floor, conditional on the board's wall count. A request for
 * many walls inevitably makes some decorative, dragging the utilization *fraction*
 * down even when plenty of walls do real work — so past the default wallsRange top
 * the floor relaxes from a fixed 0.2 fraction to "at least `MIN_USEFUL_WALLS`
 * walls stop a piece". Unchanged (0.2) up to 15 walls; looser beyond. Never
 * tighter, so it only ever loosens.
 */
export function minWallUtilization(wallCount: number): number {
  return Math.min(MIN_WALL_UTILIZATION, MIN_USEFUL_WALLS / wallCount);
}

/**
 * G8 economy gate: at most this fraction of the board may be dead — cells no
 * trail enters that hold no piece or destination. Equivalently a 20% *live*
 * floor (mirrors G7's 0.2). Very conservative: the hand-built corpus runs
 * 0.44–0.81 dead, so this rejects only boards that touch under a fifth of the
 * grid. A placeholder until scores are surfaced in the generator for tuning.
 */
const MAX_DEAD_SPACE = 0.8;

/**
 * G10 clutter gate: reject boards whose `clumping` (share of same-kind
 * wall/blocker pairs bunched within one cell) exceeds this. Static, so it runs
 * before the solve. Deliberately a *tail-catcher*, not the main clutter lever —
 * clumping is the strongest human-complaint signal (calibration ρ −0.35, the
 * "clumped" tag) but bad and good boards overlap heavily on it, so mild clutter
 * is shaped softly by the composite negative; only egregious cases are hard
 * rejected. At 0.25 the hand-built corpus loses ~1% (its p99 is 0.23; one
 * outlier `pil` at 0.41). Tunable.
 */
const MAX_CLUMPING = 0.25;

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
 * The static half of the quality gates — the ones the layout alone answers, so
 * they run before any solve:
 *  - G9 no trapped blocker (walled in on all four sides)
 *  - G10 clumping <= MAX_CLUMPING (egregious clutter)
 *
 * Split out so the generation loop can reject a hopeless layout without paying
 * for a solve; {@link checkQualityGates} runs it again as part of the full
 * verdict.
 */
export function checkStaticGates(board: Board): GateResult {
  if (hasTrappedBlocker(board)) return { passed: false, failedGate: "G9" };
  if (clumping(board) > MAX_CLUMPING) {
    return { passed: false, failedGate: "G10" };
  }
  return { passed: true };
}

/**
 * The solve-dependent quality gates, cheapest-first, short-circuiting on the
 * first fail:
 *  - G4 every optimal solution moves at least one blocker (blockers matter)
 *  - G5 unused blockers <= maxUnusedBlockers(count) (dense requests allowed more)
 *  - G6 every route travels >= minMoves * LENGTH_FACTOR cells (not cramped/trivial)
 *  - G7 wall utilization >= minWallUtilization(count) (wall-heavy requests looser)
 *  - G8 dead space <= MAX_DEAD_SPACE (action doesn't huddle in one corner)
 *
 * G7–G8 gate board economy — clutter and wasted space — but like G4–G6 are
 * measured across the puzzle's solutions, not from the static layout alone.
 */
function checkSolvedGates(board: Board, result: SolverResult): GateResult {
  const solutions = deduplicateSolutions(enumerateSolutions(result.dag));

  const everyUsesBlocker = solutions.every((moves) =>
    moveRoles(board, moves).some((r) => r === "blocker")
  );
  if (!everyUsesBlocker) return { passed: false, failedGate: "G4" };

  const used = new Set<number>();
  for (const moves of solutions) {
    for (const id of usedBlockerIds(board, moves)) used.add(id);
  }
  const blockerCount = board.pieces.filter((p) => p.type === "blocker").length;
  const unused = board.pieces
    .filter((p, i) => p.type === "blocker" && !used.has(i))
    .length;
  if (unused > maxUnusedBlockers(blockerCount)) {
    return { passed: false, failedGate: "G5" };
  }

  let minTravel = Infinity;
  for (const moves of solutions) {
    minTravel = Math.min(minTravel, totalDistance(board, moves));
  }
  if (minTravel < result.minMoves * LENGTH_FACTOR) {
    return { passed: false, failedGate: "G6" };
  }

  if (
    wallUtilization(board, solutions) < minWallUtilization(board.walls.length)
  ) {
    return { passed: false, failedGate: "G7" };
  }

  if (deadSpace(board, solutions) > MAX_DEAD_SPACE) {
    return { passed: false, failedGate: "G8" };
  }

  return { passed: true };
}

/**
 * Whether a board is good enough to be a candidate, whatever made it: G9–G10
 * on the layout, then G4–G8 across its optimal solutions. Nothing here asks
 * where the board came from.
 *
 * Gate numbers are historical, order is by cost. Hard rejects during
 * generation, but no constraint on manual editing.
 */
export function checkQualityGates(
  board: Board,
  result: SolverResult,
): GateResult {
  const staticGate = checkStaticGates(board);
  if (!staticGate.passed) return staticGate;
  return checkSolvedGates(board, result);
}

/** A generation run's verdict — the solve is handed back on a pass. */
export type GenerationGateResult =
  | { passed: false; failedGate: GateResult["failedGate"] }
  | { passed: true; result: SolverResult };

/**
 * The gates that only mean something inside a generation run:
 *  - G1 solvable within the target depth
 *  - G2 minMoves is exactly `targetMoves`
 *  - G3 canonical hash not already in the corpus or this batch
 *
 * Meaningless for a board that already exists — a corpus puzzle fails G3 by
 * definition — so they are no part of candidacy; see {@link checkQualityGates}.
 * The solve rides along on a pass, being the expensive part.
 */
export function checkGenerationGates(
  board: Board,
  options: {
    /** Exact minMoves the board must solve in (G2) — see `MOVE_TARGETS`. */
    targetMoves: number;
    corpus: Set<string>;
    batchHashes: Set<string>;
    /**
     * BFS state budget for the gate solve. The generation loop passes a tight
     * cap so pathologically branchy candidates reject fast (G1) instead of
     * blocking the loop for seconds; omitted elsewhere for the full solver limit.
     */
    maxStates?: number;
  },
): GenerationGateResult {
  let result: SolverResult;
  try {
    // Capping the search at the target is what makes an exact-target run
    // affordable: a board that needs more moves blows the depth limit and
    // rejects as G1 instead of being solved in full only to fail G2. The
    // branchy deep boards were most of the old loop's cost.
    result = solveExhaustiveSync(board, {
      maxDepth: options.targetMoves,
      maxStates: options.maxStates,
    });
  } catch {
    return { passed: false, failedGate: "G1" };
  }

  if (result.minMoves !== options.targetMoves) {
    return { passed: false, failedGate: "G2" };
  }

  const hash = boardCanonicalHash(board);
  if (options.corpus.has(hash) || options.batchHashes.has(hash)) {
    return { passed: false, failedGate: "G3" };
  }

  return { passed: true, result };
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
export type BoundCtx = { minMoves: number; blockers: number };
type Bound = (ctx: BoundCtx) => number;

/**
 * Score calibration — the per-metric max bounds the composite normalizes against,
 * split into positive and negative terms. This is the single tunable source of
 * truth; bump `version` on every change so a corpus report is traceable to the
 * calibration that produced it — `deno task score-corpus` stamps this version
 * into both the report body and its filename.
 *
 * v1 used theoretical maxes and came out *anti-correlated* with human judgement
 * — both the rated corpus boards (erik > torstein > kim > malene) and the first
 * labeled generated set (a 2★ board scored top, a 5★ board bottom) inverted.
 *
 * v2 was a conservative structural correction (dropped `firstMovePrecision`,
 * promoted `wallUtilization`/`deadSpace`, added shaped `variety`) tuned on 11
 * labels; the 35-label batch showed it still carried no rank signal (pooled
 * ρ = 0.07).
 *
 * v3 prunes the composite down to the metrics the 39-board labeled set showed
 * actually track ratings (per-metric ρ from `check-calibration`):
 *  - kept: `stopWeighted` (+0.38), `pieceUsage` (+0.27), `wallUtilization`
 *    (+0.19), `reversals` (+0.18), `searchProfile` (+0.12) — the "blockers and
 *    walls actually matter" cluster, matching the dominant human complaints
 *    (obvious solutions, useless blockers, decorative walls);
 *  - kept `variety` on corpus ground truth (the malene profile) despite a flat
 *    ρ in this batch — the generated set barely exercises it;
 *  - dropped `coverage` (−0.22), `crossTrailOverlap` (−0.19), `deception`
 *    (−0.07), `totalDistance` and `setupRatio` (~0) — anti-signal or noise
 *    that diluted the composite as equal-weight positives;
 *  - dropped `deadSpace` from the negatives (raw ρ +0.01 — board economy is
 *    gate territory, G8 keeps it); kept the two zero-variance penalties as
 *    safety rails against degenerate routes.
 *
 * v4 promoted `clumping` into the negatives: measured on the same labeled set
 * it came out the second-strongest signal overall (ρ = −0.35), confirming the
 * most common human complaint tag.
 *
 * v5 dropped `variety`. Two independent lines condemned it: its rating ρ was ~0
 * (kept in v3 only on the corpus-ground-truth hunch), and PostHog behaviour
 * (player-adjusted optimal-solve rate over 192 corpus boards) showed
 * `uniqueSolutions` tracks *easiness* (ρ +0.18) — so variety was a positive that
 * rewarded easy multi-solution boards while penalising the isolated-brilliant
 * profile (torstein, few solutions). Removing it lifted pooled ρ 0.373 → 0.488
 * and restored the corpus order (malene ≈ torstein ≫ erik > kim). Quality is
 * non-monotonic in solution count (both varied-malene and isolated-torstein are
 * 5★), so the varied side wants a difficulty-gated / U-shaped term, not a naive
 * "more solutions = better" — deferred until such a term is designed and earns
 * its ρ (`nearMissCount`/`isolationGap`, both advisory, are the raw material).
 */
export const CALIBRATION: {
  /**
   * Semver. Major = composite membership/bounds change (scores not comparable
   * across it — report and cache files are keyed to this); minor = additive
   * advisory metrics that don't enter the composite; patch = docs/refactors.
   * Pre-semver reports used bare integers (v1, v2).
   */
  version: string;
  positive: Record<string, Bound>;
  negative: Record<string, Bound>;
} = {
  version: "5.0.0",
  positive: {
    pieceUsage: ({ minMoves: m, blockers: p }) =>
      p * Math.log2(1 + m) + Math.log2(1 + p),
    reversals: ({ minMoves: m }) => Math.max(1, m - 1),
    searchProfile: () => 1,
    stopWeighted: ({ minMoves: m }) => 3 * m,
    wallUtilization: () => 1,
  },
  negative: {
    pointlessClearance: ({ minMoves: m }) => Math.max(1, m),
    sameDirectionRepeat: () => COLS * ROWS,
    clumping: () => 1,
  },
};

/**
 * Composite quality score for a single route in `[-1, 1]`. Each metric is divided
 * by its `CALIBRATION` max so it lands in `[0,1]`, then positives are averaged and
 * the two negatives subtracted — equal footing, no metric dominating by range.
 *
 * Exported (with `BoundCtx`) so calibration tooling can recompute composites
 * from cached route metrics without re-solving the board.
 */
export function compositeScore(metrics: Metrics, ctx: BoundCtx): number {
  // Every CALIBRATION term maps to a metric by name (no synthetic terms since
  // v5 dropped the shaped `variety`); a Record keeps that indirection open.
  const values: Record<string, number> = { ...metrics };

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
    | "puckPathVariety"
    | "clumping"
    | "emptyRegion"
    | "wallSymmetry"
    | "firstMovePrecision"
    | "searchProfile"
    | "isolationGap"
    | "nearMissCount"
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
    openingSetup: openingSetup(board, route),
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
  const nearMiss = genuineNearMisses(result, routes);
  const shared = {
    uniqueSolutions: uniqueSolutions(board, routes),
    wallUtilization: wallUtilization(board, routes),
    deadSpace: deadSpace(board, routes),
    puckPathVariety: puckPathVariety(board, routes),
    clumping: clumping(board),
    emptyRegion: emptyRegion(board),
    wallSymmetry: wallSymmetry(board),
    firstMovePrecision: firstMovePrecision(result),
    searchProfile: searchProfile(result),
    isolationGap: nearMiss.gap,
    nearMissCount: nearMiss.count,
  };

  const ctx: BoundCtx = {
    minMoves: result.minMoves,
    blockers: board.pieces.filter((piece) => piece.type === "blocker").length,
  };
  const perSolution: SolutionScore[] = [];
  for (const route of routes) {
    const metrics = routeMetrics(board, route, shared);
    perSolution.push({
      moves: route,
      metrics,
      score: compositeScore(metrics, ctx),
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
