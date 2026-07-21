import { COLS, ROWS } from "#/game/board.ts";
import type { Board, Move, Puzzle } from "#/game/types.ts";
import { CompactSet } from "#/lib/compact-set.ts";

/**
 * Default solver limits.
 */
const DEFAULT_MAX_DEPTH = 15;

/**
 * BFS state limit — hard cap to prevent OOM on pathological boards.
 * Flat typed arrays cost ~31 bytes per entry (statePool + metadata + CompactSet),
 * so 10M states ≈ 310 MB worst case with 8 pieces.
 * Medium puzzles stay well under 100K; hard puzzles (7+ pieces) may need several million.
 */
const BFS_STATE_LIMIT = 10_000_000;

// Error thrown when the solver exceeds the maximum search depth or state limit
export class SolverDepthExceededError extends Error {
  constructor(depth: number) {
    super(`Solver depth ${depth} exceeded`);
    this.name = "SolverDepthExceededError";
  }
}

/**
 * Result of an exhaustive solve. Exposes the shortest-path DAG rather than a
 * materialized solution list: every optimal move sequence can be walked out of
 * `dag`, but the (possibly exponential) raw set is never built unless a consumer
 * asks for it via `enumerateSolutions`. `statesPerDepth[d]` counts states first
 * reached at depth `d` (index 0 is the initial state), spanning depth 0..minMoves.
 */
export type SolverResult = {
  minMoves: number;
  statesPerDepth: number[];
  dag: SolutionDag;
};

/** An optimal move into a state from one of its predecessors. */
export type SolutionEdge = { from: number; move: Move };

/**
 * Shortest-path DAG of a solved board. Nodes are opaque integer ids; `root` is
 * the start state and `goals` are the states with the puck on the destination.
 * `predecessors` maps each optimal state to the moves that reach it optimally —
 * the tree parent plus any same-depth alternatives. Walk backward from `goals`
 * to enumerate or canonicalize solutions without materializing the raw path set.
 */
export type SolutionDag = {
  root: number;
  goals: number[];
  predecessors: Map<number, SolutionEdge[]>;
};

export type SolverProgress = { depth: number };
export type SolverEvent =
  | { type: "progress" } & SolverProgress
  | { type: "solution"; moves: Move[] }
  | { type: "error"; message: string };

type WallLookup = {
  /** hWalls[x] = y-values of horizontal walls that block vertical movement in column x */
  hWalls: number[][];
  /** vWalls[y] = x-values of vertical walls that block horizontal movement in row y */
  vWalls: number[][];
};

type Config = {
  pieceCount: number;
} & WallLookup;

/**
 * Solver configuration options.
 */
type SolverOptions = {
  // Maximum search depth in moves (default: 15)
  maxDepth?: number;
  // Hard cap on BFS states before bailing with SolverDepthExceededError
  // (default: BFS_STATE_LIMIT). A tighter budget also shrinks the pre-allocated
  // typed arrays — the generation gate check passes a small value so branchy
  // boards reject fast instead of grinding through millions of states.
  maxStates?: number;
};

/** Parallel per-state metadata for the flat BFS queue, indexed by state index. */
type Metadata = {
  parentIndexes: Int32Array;
  fromPositions: Uint8Array;
  toPositions: Uint8Array;
  depths: Uint8Array;
};

/** An alternative optimal-length arrival into a state: which parent and move. */
type ParentEdge = { parent: number; from: number; to: number };

/**
 * Solves a board using BFS, yielding a progress event then the solution.
 *
 * BFS visits each unique board state once — no repeated passes like IDA*.
 * Compact state representation (Uint8Array + numeric key) and parent-pointer
 * path reconstruction keep memory well under the BFS_STATE_LIMIT for typical
 * medium-difficulty puzzles.
 *
 * Throws SolverDepthExceededError when no solution is found within maxDepth
 * or when the state count exceeds BFS_STATE_LIMIT.
 */
export function* solve(
  puzzleOrBoard: Board | Puzzle,
  options: SolverOptions = {},
): Generator<SolverEvent> {
  const board = "board" in puzzleOrBoard ? puzzleOrBoard.board : puzzleOrBoard;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const solver = bfsExplore(board, maxDepth, false);
  let result = solver.next();
  while (!result.done) {
    yield { type: "progress", depth: result.value };
    result = solver.next();
  }
  yield { type: "solution", moves: firstSolution(result.value.dag) };
}

/**
 * Solves a puzzle synchronously, returning the first optimal solution's moves.
 * Shares the exhaustive solver's machinery (`bfsExplore`) but stops at the first
 * optimal path; the full shortest-path DAG (all solutions, search shape) is
 * available via `solveExhaustiveSync`.
 */
export function solveSync(
  puzzleOrBoard: Puzzle | Board,
  options: SolverOptions = {},
): Move[] {
  const board = "board" in puzzleOrBoard ? puzzleOrBoard.board : puzzleOrBoard;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  const result = runToCompletion(bfsExplore(board, maxDepth, false));
  return firstSolution(result.dag);
}

/**
 * Solves a puzzle exhaustively, returning the shortest-path DAG plus the search
 * shape (`statesPerDepth`). Used by the scoring pipeline, not the gameplay path
 * (which stays on the faster single-solution `solveSync`). The DAG is bounded by
 * the states explored; consumers canonicalize or enumerate off it as needed.
 *
 * Throws SolverDepthExceededError / "Unsolvable puzzle" with the same semantics
 * as `solveSync`.
 */
export function solveExhaustiveSync(
  puzzleOrBoard: Puzzle | Board,
  options: SolverOptions = {},
): SolverResult {
  const board = "board" in puzzleOrBoard ? puzzleOrBoard.board : puzzleOrBoard;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxStates = options.maxStates ?? BFS_STATE_LIMIT;

  return runToCompletion(bfsExplore(board, maxDepth, true, maxStates));
}

/** Drives a `bfsExplore` generator to completion, discarding progress yields. */
function runToCompletion(
  search: Generator<number, SolverResult>,
): SolverResult {
  let result = search.next();
  while (!result.done) result = search.next();
  return result.value;
}

/**
 * Materializes every optimal move sequence from a solution DAG by walking
 * backward from each goal through its predecessors. Worst-case exponential (a
 * board with many independent moves has combinatorially many equivalent orderings)
 * — the scoring pipeline canonicalizes off the DAG instead. Use this for tests,
 * verification, or small solution sets.
 */
export function enumerateSolutions(dag: SolutionDag): Move[][] {
  const solutions: Move[][] = [];
  const reversed: Move[] = [];

  const walk = (node: number): void => {
    const edges = dag.predecessors.get(node);
    if (!edges) {
      solutions.push(reversed.slice().reverse());
      return;
    }
    for (const edge of edges) {
      reversed.push(edge.move);
      walk(edge.from);
      reversed.pop();
    }
  };

  for (const goal of dag.goals) walk(goal);
  return solutions;
}

/**
 * The distinct first moves that keep the puzzle on an optimal path — every root
 * out-edge of the DAG. A DAG-derived scalar (no path materialization) measuring
 * how forced the opening is. Counts raw openings, not canonical routes: one route
 * that can legally open two ways contributes two distinct first moves.
 */
export function optimalFirstMoves(dag: SolutionDag): Move[] {
  const seen = new Set<number>();
  const moves: Move[] = [];

  for (const edges of dag.predecessors.values()) {
    for (const edge of edges) {
      if (edge.from !== dag.root) continue;
      const [from, to] = edge.move;
      const key = (from.y * COLS + from.x) * 64 + (to.y * COLS + to.x);
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push(edge.move);
    }
  }

  return moves;
}

/** Walks one optimal path, following the first predecessor at each step. */
function firstSolution(dag: SolutionDag): Move[] {
  const moves: Move[] = [];
  let edges = dag.predecessors.get(dag.goals[0]);
  while (edges) {
    const [edge] = edges;
    moves.push(edge.move);
    edges = dag.predecessors.get(edge.from);
  }
  moves.reverse();
  return moves;
}

/**
 * Unified BFS core for both the single-solution gameplay path and the exhaustive
 * scoring path. Visits each unique board state once using flat typed arrays
 * (statePool + parallel metadata) to avoid per-state heap allocation, and yields
 * the depth whenever the frontier advances (drives the "searching depth N" UI).
 *
 * `exhaustive` selects between two behaviours over the same machinery:
 *  - `false` → stop at the first goal. Uses a `CompactSet` for the visited check
 *    (membership only) to stay lean for the interactive solver worker; the DAG is
 *    the single parent chain to that goal.
 *  - `true` → keep going until the whole optimal depth is drained, recording
 *    `statesPerDepth` and same-depth alternative arrivals (`extraParents`) so the
 *    full shortest-path DAG — every optimal solution — can be reconstructed.
 *
 * Throws SolverDepthExceededError if maxDepth or BFS_STATE_LIMIT is reached
 * without a solution, or "Unsolvable puzzle" when the queue drains with no goal.
 */
function* bfsExplore(
  board: Board,
  maxDepth: number,
  exhaustive: boolean,
  stateLimit: number = BFS_STATE_LIMIT,
): Generator<number, SolverResult> {
  const destPos = board.destination.y * COLS + board.destination.x;
  const initialState = initState(board);
  const statesPerDepth: number[] = [1];

  if (initialState[0] === destPos) {
    return {
      minMoves: 0,
      statesPerDepth,
      dag: { root: 0, goals: [0], predecessors: new Map() },
    };
  }

  const config: Config = {
    ...buildWallLookup(board.walls),
    pieceCount: initialState.length,
  };

  // State pool: all states packed flat — no heap object per state
  const statePool = new Uint8Array(stateLimit * config.pieceCount);
  statePool.set(initialState, 0);

  const metadata: Metadata = {
    parentIndexes: new Int32Array(stateLimit).fill(-1),
    fromPositions: new Uint8Array(stateLimit),
    toPositions: new Uint8Array(stateLimit),
    depths: new Uint8Array(stateLimit), // max depth 15 fits in u8
  };

  // Pre-allocated moves buffer: 4 directions × n pieces × 2 values (from + to)
  const buffer = new Uint8Array(config.pieceCount * 8);

  // Single-solution mode only needs membership (CompactSet); exhaustive mode
  // needs stateKey → index so same-depth alternative arrivals can be attached.
  const visited = exhaustive ? null : new CompactSet();
  const visitedIndex = exhaustive ? new Map<number, number>() : null;
  const extraParents = new Map<number, ParentEdge[]>();
  const goalIndices: number[] = [];

  const rootKey = stateKeyAt(statePool, config, 0);
  if (visitedIndex) visitedIndex.set(rootKey, 0);
  else visited!.add(rootKey);

  const toResult = (minMoves: number): SolverResult => ({
    minMoves,
    statesPerDepth,
    dag: buildDag(metadata, extraParents, goalIndices),
  });

  let tail = 1; // next free slot (write end of the queue)
  let head = 0; // next state to process (read end of the queue)
  let lastDepth = 0;
  let goalDepth = -1;
  let hitMaxDepth = false;

  while (head < tail) {
    const headOffset = head * config.pieceCount;
    const depth = metadata.depths[head];
    const parentIdx = head;
    head++;

    if (depth > lastDepth) {
      lastDepth = depth;
      yield depth;
    }

    // Below the optimal depth we expand normally; once the goal depth is known
    // (exhaustive mode) we stop expanding but let the queue drain so every
    // depth-`goalDepth` goal state is still collected and multi-parent-tracked.
    if (goalDepth !== -1) {
      if (depth >= goalDepth) continue;
    } else if (depth >= maxDepth) {
      hitMaxDepth = true;
      continue;
    }

    const moveCount = getMoves(statePool, config, headOffset, buffer);

    // Each move is a [fromPos, toPos] pair packed consecutively in buffer.
    for (let idx = 0; idx < moveCount; idx += 2) {
      if (tail >= stateLimit) {
        throw new SolverDepthExceededError(maxDepth);
      }

      const fromPos = buffer[idx];
      const toPos = buffer[idx + 1];
      const childDepth = depth + 1;

      // Write the candidate child into the tail slot so it can be keyed.
      const tailOffset = tail * config.pieceCount;
      applyMove(statePool, config, headOffset, tailOffset, fromPos, toPos);
      const key = stateKeyAt(statePool, config, tailOffset);

      if (visitedIndex) {
        const existing = visitedIndex.get(key);
        if (existing !== undefined) {
          // Same-depth rediscovery is an alternative optimal arrival; a deeper
          // rediscovery is never on a shortest path and is ignored.
          if (metadata.depths[existing] === childDepth) {
            const edge = { parent: parentIdx, from: fromPos, to: toPos };
            const edges = extraParents.get(existing);
            if (edges) edges.push(edge);
            else extraParents.set(existing, [edge]);
          }
          continue;
        }
        visitedIndex.set(key, tail);
      } else {
        if (visited!.has(key)) continue;
        visited!.add(key);
      }

      metadata.parentIndexes[tail] = parentIdx;
      metadata.fromPositions[tail] = fromPos;
      metadata.toPositions[tail] = toPos;
      metadata.depths[tail] = childDepth;
      statesPerDepth[childDepth] = (statesPerDepth[childDepth] ?? 0) + 1;

      if (statePool[tailOffset] === destPos) {
        goalIndices.push(tail);
        // Single-solution mode: the first goal reached is an optimal path.
        if (!exhaustive) return toResult(childDepth);
        if (goalDepth === -1) goalDepth = childDepth;
      }

      tail++;
    }
  }

  if (goalDepth === -1) {
    if (hitMaxDepth) throw new SolverDepthExceededError(maxDepth);
    throw new Error("Unsolvable puzzle");
  }

  return toResult(goalDepth);
}

/**
 * Builds the shortest-path DAG from the BFS metadata: walks backward from every
 * goal, recording each optimal state's predecessors (primary parent + any
 * same-depth alternatives). Bounded by the optimal subgraph — never materializes
 * paths. In single-solution mode `extraParents` is empty, so this is one chain.
 */
function buildDag(
  metadata: Metadata,
  extraParents: Map<number, ParentEdge[]>,
  goalIndices: number[],
): SolutionDag {
  const predecessors = new Map<number, SolutionEdge[]>();
  const stack = [...goalIndices];
  const seen = new Set<number>();

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);

    const primary = metadata.parentIndexes[node];
    if (primary === -1) continue; // root has no incoming edges

    const edges: SolutionEdge[] = [{
      from: primary,
      move: toMove(metadata.fromPositions[node], metadata.toPositions[node]),
    }];
    for (const extra of extraParents.get(node) ?? []) {
      edges.push({ from: extra.parent, move: toMove(extra.from, extra.to) });
    }

    predecessors.set(node, edges);
    for (const edge of edges) stack.push(edge.from);
  }

  return { root: 0, goals: goalIndices, predecessors };
}

/** Decodes a packed [fromPos, toPos] edge into a Move. */
function toMove(fromPos: number, toPos: number): Move {
  return [
    { x: fromPos % COLS, y: (fromPos / COLS) | 0 },
    { x: toPos % COLS, y: (toPos / COLS) | 0 },
  ];
}

/**
 * Copies the current state into a new pool slot, then applies the move.
 *
 * Blockers are kept sorted in ascending position order so that any two states
 * representing the same board layout produce the same stateKey — regardless of
 * which blocker moved. Without this, BFS would revisit equivalent states.
 *
 * After updating the moved blocker's position, one of the two insertion-sort
 * passes runs to restore order: bubble left if the new position is smaller than
 * its left neighbour, or bubble right if larger than its right neighbour.
 * Only one direction fires per move; the other loop exits immediately.
 */
function applyMove(
  pool: Uint8Array,
  config: Config,
  srcOffset: number,
  dstOffset: number,
  fromPos: number,
  toPos: number,
): void {
  pool.copyWithin(dstOffset, srcOffset, srcOffset + config.pieceCount);

  // Puck is always at index 0 — no sorting needed when it moves.
  if (pool[dstOffset] === fromPos) {
    pool[dstOffset] = toPos;
    return;
  }

  // Find the moved blocker and update its position.
  let i = 1;
  while (i < config.pieceCount) {
    if (pool[dstOffset + i] === fromPos) break;
    i++;
  }

  pool[dstOffset + i] = toPos;

  // Bubble left if the blocker moved to a smaller position.
  while (i > 1 && pool[dstOffset + i] < pool[dstOffset + i - 1]) {
    const tmp = pool[dstOffset + i];
    pool[dstOffset + i] = pool[dstOffset + i - 1];
    pool[dstOffset + i - 1] = tmp;
    i--;
  }

  // Bubble right if the blocker moved to a larger position.
  while (
    i < config.pieceCount - 1 && pool[dstOffset + i] > pool[dstOffset + i + 1]
  ) {
    const tmp = pool[dstOffset + i];
    pool[dstOffset + i] = pool[dstOffset + i + 1];
    pool[dstOffset + i + 1] = tmp;
    i++;
  }
}

/**
 * Writes flat move pairs [from0, to0, from1, to1, …] into buf for all valid moves.
 * Returns the number of values written (always even).
 *
 * For each piece, walls and other pieces narrow the four sliding ranges.
 * No occupancy check needed — the piece-constraint loop already stops the slider
 * one cell before any blocker, so the destination is always free.
 */
function getMoves(
  pool: Uint8Array,
  config: Config,
  offset: number,
  buffer: Uint8Array,
): number {
  let count = 0;

  for (let piece = 0; piece < config.pieceCount; piece++) {
    const piecePos = pool[offset + piece];
    const pieceX = piecePos % COLS;
    const pieceY = (piecePos / COLS) | 0;

    // Target min/max positions along the outer bounds of the grid
    let up = 0, down = ROWS - 1, left = 0, right = COLS - 1;

    // Check all vertical walls, and stop when hit
    for (const wallY of config.hWalls[pieceX]) {
      if (wallY <= pieceY && wallY > up) up = wallY;
      if (wallY > pieceY && wallY - 1 < down) down = wallY - 1;
    }

    // Check all horizontal walls, and stop when hit
    for (const wallX of config.vWalls[pieceY]) {
      if (wallX <= pieceX && wallX > left) left = wallX;
      if (wallX > pieceX && wallX - 1 < right) right = wallX - 1;
    }

    // Check against all other pieces
    for (let otherPiece = 0; otherPiece < config.pieceCount; otherPiece++) {
      if (otherPiece === piece) continue;

      const otherPos = pool[offset + otherPiece];
      const otherX = otherPos % COLS;
      const otherY = (otherPos / COLS) | 0;

      if (otherY === pieceY) {
        if (otherX < pieceX && otherX >= left) left = otherX + 1;
        if (otherX > pieceX && otherX <= right) right = otherX - 1;
      } else if (otherX === pieceX) {
        if (otherY < pieceY && otherY >= up) up = otherY + 1;
        if (otherY > pieceY && otherY <= down) down = otherY - 1;
      }
    }

    // Emit one move per direction where the piece actually slides somewhere new.
    if (up !== pieceY) {
      buffer[count++] = piecePos;
      buffer[count++] = up * COLS + pieceX;
    }

    if (down !== pieceY) {
      buffer[count++] = piecePos;
      buffer[count++] = down * COLS + pieceX;
    }
    if (left !== pieceX) {
      buffer[count++] = piecePos;
      buffer[count++] = pieceY * COLS + left;
    }
    if (right !== pieceX) {
      buffer[count++] = piecePos;
      buffer[count++] = pieceY * COLS + right;
    }
  }

  return count;
}

/**
 * Takes the board walls and builds 2 index arrays
 * one for horizontal, one for vertical.
 */
function buildWallLookup(walls: Board["walls"]): WallLookup {
  const hWalls: number[][] = Array.from({ length: COLS }, () => []);
  const vWalls: number[][] = Array.from({ length: ROWS }, () => []);

  for (const wall of walls) {
    if (wall.orientation === "horizontal") hWalls[wall.x].push(wall.y);
    else vWalls[wall.y].push(wall.x);
  }

  return { hWalls, vWalls };
}

/**
 * Initialised the indexed board state
 */
function initState(board: Board): Uint8Array {
  const puck = board.pieces.find((p) => p.type === "puck")!;
  const blockers = board.pieces
    .filter((piece) => piece.type === "blocker")
    .map((piece) => piece.y * COLS + piece.x)
    .sort((a, b) => a - b);
  return new Uint8Array([puck.y * COLS + puck.x, ...blockers]);
}

/**
 * Get packed integer key — safe for up to 8 pieces (64^8 < Number.MAX_SAFE_INTEGER).
 */
function stateKeyAt(pool: Uint8Array, config: Config, offset: number): number {
  let key = 0;

  for (let pieceIdx = 0; pieceIdx < config.pieceCount; pieceIdx++) {
    key = key * 64 + pool[offset + pieceIdx];
  }

  return key;
}
