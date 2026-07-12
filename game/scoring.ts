import {
  COLS,
  flipBoard,
  isPositionSame,
  resolveMoves,
  rotateBoard,
  ROWS,
} from "#/game/board.ts";
import { getCanonicalMoveKey } from "#/game/strings.ts";
import type { Board, Direction, Move, Position } from "#/game/types.ts";

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
