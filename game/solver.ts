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
 * Result of an exhaustive solve — every optimal solution plus search shape.
 * `statesPerDepth[d]` counts states first reached at depth `d` (index 0 is the
 * initial state), so it spans depth 0..minMoves.
 */
export type SolverResult = {
  minMoves: number;
  solutions: Move[][];
  statesPerDepth: number[];
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
};

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

  const solver = bfsSolve(board, maxDepth);
  let result = solver.next();
  while (!result.done) {
    yield { type: "progress", depth: result.value };
    result = solver.next();
  }
  yield { type: "solution", moves: result.value };
}

/**
 * Solves a puzzle synchronously using BFS to find the minimum move solution.
 */
export function solveSync(
  puzzleOrBoard: Puzzle | Board,
  options: SolverOptions = {},
): Move[] {
  const board = "board" in puzzleOrBoard ? puzzleOrBoard.board : puzzleOrBoard;

  for (const event of solve(board, options)) {
    if (event.type === "solution") return event.moves;
  }

  throw new Error("Unsolvable puzzle");
}

/**
 * Solves a puzzle exhaustively — enumerates every optimal solution and records
 * the search shape (`statesPerDepth`). Used by the scoring pipeline, not the
 * gameplay path (which stays on the faster single-solution `solveSync`).
 *
 * Throws SolverDepthExceededError / "Unsolvable puzzle" with the same semantics
 * as `solveSync`.
 */
export function solveAllSync(
  puzzleOrBoard: Puzzle | Board,
  options: SolverOptions = {},
): SolverResult {
  const board = "board" in puzzleOrBoard ? puzzleOrBoard.board : puzzleOrBoard;
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;

  return bfsSolveAll(board, maxDepth);
}

/**
 * BFS solver — visits each unique state exactly once, guarantees optimal solution.
 *
 * Uses flat typed arrays for the BFS queue (statePool + parallel metadata arrays)
 * to eliminate heap object allocation per state. Path is reconstructed via parent
 * pointers rather than storing full histories.
 *
 * Throws SolverDepthExceededError if the state count exceeds BFS_STATE_LIMIT
 * (very deep or wall-sparse boards) or if maxDepth is reached without solution.
 */
function* bfsSolve(board: Board, maxDepth: number): Generator<number, Move[]> {
  const destPos = board.destination.y * COLS + board.destination.x;
  const initialState = initState(board);

  if (initialState[0] === destPos) return [];

  const config: Config = {
    ...buildWallLookup(board.walls),
    pieceCount: initialState.length,
  };

  // State pool: all states packed flat — no heap object per state
  const statePool = new Uint8Array(BFS_STATE_LIMIT * config.pieceCount);
  statePool.set(initialState, 0);

  // Parallel arrays for entry metadata
  const metadata = {
    parentIndexes: new Int32Array(BFS_STATE_LIMIT).fill(-1),
    fromPositions: new Uint8Array(BFS_STATE_LIMIT),
    toPositions: new Uint8Array(BFS_STATE_LIMIT),
    depths: new Uint8Array(BFS_STATE_LIMIT), // max depth 15 fits in u8
  };

  // Pre-allocated moves buffer: 4 directions × n pieces × 2 values (from + to)
  const buffer = new Uint8Array(config.pieceCount * 8);

  const visited = new CompactSet();
  const stateKey = stateKeyAt(statePool, config, 0);
  visited.add(stateKey);

  let tail = 1; // next free slot (write end of the queue)
  let head = 0; // next state to process (read end of the queue)
  let lastDepth = 0;
  let hitMaxDepth = false;

  while (head < tail) {
    if (tail >= BFS_STATE_LIMIT) {
      throw new SolverDepthExceededError(maxDepth);
    }

    const headOffset = head * config.pieceCount;
    const depth = metadata.depths[head];
    const parentIdx = head;
    head++;

    if (depth > lastDepth) {
      lastDepth = depth;
      yield depth;
    }

    if (depth >= maxDepth) {
      hitMaxDepth = true;
      continue;
    }

    const moveCount = getMoves(statePool, config, headOffset, buffer);

    // Each move is a [fromPos, toPos] pair packed consecutively in buffer
    for (let idx = 0; idx < moveCount; idx += 2) {
      const fromPos = buffer[idx];
      const toPos = buffer[idx + 1];

      // Write next state directly into statePool at tail offset
      const tailOffset = tail * config.pieceCount;

      applyMove(statePool, config, headOffset, tailOffset, fromPos, toPos);

      const stateKey = stateKeyAt(statePool, config, tailOffset);

      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      metadata.parentIndexes[tail] = parentIdx;
      metadata.fromPositions[tail] = fromPos;
      metadata.toPositions[tail] = toPos;
      metadata.depths[tail] = depth + 1;

      if (statePool[tailOffset] === destPos) {
        return reconstructPath(metadata, tail);
      }

      tail++;
    }
  }

  if (hitMaxDepth) throw new SolverDepthExceededError(maxDepth);
  throw new Error("Unsolvable puzzle");
}

/** An alternative optimal-length arrival into a state: which parent and move. */
type ParentEdge = { parent: number; from: number; to: number };

/**
 * Exhaustive BFS — enumerates every optimal solution instead of returning the
 * first one, and records how many new states appear at each depth.
 *
 * Same flat typed-array machinery as `bfsSolve`, with three additions:
 *  - `statesPerDepth[d]` counts states first reached at depth d (seed = 1).
 *  - `extraParents` records same-depth alternative arrivals into a state, so the
 *    shortest-path DAG (not just a tree) is captured.
 *  - Once the optimal depth is known, states at that depth are collected as goals
 *    but never expanded; all optimal paths are then walked out backward.
 */
function bfsSolveAll(board: Board, maxDepth: number): SolverResult {
  const destPos = board.destination.y * COLS + board.destination.x;
  const initialState = initState(board);
  const statesPerDepth: number[] = [1];

  if (initialState[0] === destPos) {
    return { minMoves: 0, solutions: [[]], statesPerDepth };
  }

  const config: Config = {
    ...buildWallLookup(board.walls),
    pieceCount: initialState.length,
  };

  const statePool = new Uint8Array(BFS_STATE_LIMIT * config.pieceCount);
  statePool.set(initialState, 0);

  const metadata = {
    parentIndexes: new Int32Array(BFS_STATE_LIMIT).fill(-1),
    fromPositions: new Uint8Array(BFS_STATE_LIMIT),
    toPositions: new Uint8Array(BFS_STATE_LIMIT),
    depths: new Uint8Array(BFS_STATE_LIMIT),
  };

  const buffer = new Uint8Array(config.pieceCount * 8);

  // stateKey -> stateIndex; membership doubles as the visited check.
  const visitedIndex = new Map<number, number>();
  const extraParents = new Map<number, ParentEdge[]>();
  visitedIndex.set(stateKeyAt(statePool, config, 0), 0);

  let tail = 1;
  let head = 0;
  let goalDepth = -1;
  let hitMaxDepth = false;
  const goalIndices: number[] = [];

  while (head < tail) {
    const headOffset = head * config.pieceCount;
    const depth = metadata.depths[head];
    const parentIdx = head;
    head++;

    // Below the optimal depth we expand normally; once it's known we stop
    // expanding (goal states carry no useful children), letting the queue drain.
    if (goalDepth !== -1) {
      if (depth >= goalDepth) continue;
    } else if (depth >= maxDepth) {
      hitMaxDepth = true;
      continue;
    }

    const moveCount = getMoves(statePool, config, headOffset, buffer);

    for (let idx = 0; idx < moveCount; idx += 2) {
      const fromPos = buffer[idx];
      const toPos = buffer[idx + 1];
      const childDepth = depth + 1;

      if (tail >= BFS_STATE_LIMIT) {
        throw new SolverDepthExceededError(maxDepth);
      }

      // Write the candidate child into the tail scratch slot to compute its key.
      const tailOffset = tail * config.pieceCount;
      applyMove(statePool, config, headOffset, tailOffset, fromPos, toPos);
      const key = stateKeyAt(statePool, config, tailOffset);

      const existing = visitedIndex.get(key);
      if (existing !== undefined) {
        // Same-depth rediscovery is an alternative optimal arrival; deeper
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
      metadata.parentIndexes[tail] = parentIdx;
      metadata.fromPositions[tail] = fromPos;
      metadata.toPositions[tail] = toPos;
      metadata.depths[tail] = childDepth;
      statesPerDepth[childDepth] = (statesPerDepth[childDepth] ?? 0) + 1;

      if (statePool[tailOffset] === destPos) {
        if (goalDepth === -1) goalDepth = childDepth;
        goalIndices.push(tail);
      }

      tail++;
    }
  }

  if (goalDepth === -1) {
    if (hitMaxDepth) throw new SolverDepthExceededError(maxDepth);
    throw new Error("Unsolvable puzzle");
  }

  return {
    minMoves: goalDepth,
    solutions: enumerateOptimalPaths(metadata, extraParents, goalIndices),
    statesPerDepth,
  };
}

/**
 * Walks the shortest-path DAG backward from every goal state, following the
 * primary parent pointer plus any recorded same-depth alternatives, to produce
 * every optimal move sequence. Each distinct sequence of edges yields a distinct
 * solution (the move sequence uniquely determines the state it reaches).
 */
function enumerateOptimalPaths(
  metadata: {
    parentIndexes: Int32Array;
    fromPositions: Uint8Array;
    toPositions: Uint8Array;
  },
  extraParents: Map<number, ParentEdge[]>,
  goalIndices: number[],
): Move[][] {
  const solutions: Move[][] = [];
  const reversed: Array<[number, number]> = [];

  const walk = (idx: number): void => {
    const primaryParent = metadata.parentIndexes[idx];

    if (primaryParent === -1) {
      const path = reversed.map(([from, to]): Move => [
        { x: from % COLS, y: (from / COLS) | 0 },
        { x: to % COLS, y: (to / COLS) | 0 },
      ]);
      path.reverse();
      solutions.push(path);
      return;
    }

    reversed.push([metadata.fromPositions[idx], metadata.toPositions[idx]]);
    walk(primaryParent);
    reversed.pop();

    for (const edge of extraParents.get(idx) ?? []) {
      reversed.push([edge.from, edge.to]);
      walk(edge.parent);
      reversed.pop();
    }
  };

  for (const goalIdx of goalIndices) walk(goalIdx);

  return solutions;
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

function reconstructPath(
  metadata: {
    parentIndexes: Int32Array;
    fromPositions: Uint8Array;
    toPositions: Uint8Array;
  },
  goalIdx: number,
): Move[] {
  const path: Array<[number, number]> = [];
  let idx = goalIdx;

  while (metadata.parentIndexes[idx] !== -1) {
    path.push([metadata.fromPositions[idx], metadata.toPositions[idx]]);
    idx = metadata.parentIndexes[idx];
  }

  path.reverse();

  return path.map(([from, to]) => [
    { x: from % COLS, y: (from / COLS) | 0 },
    { x: to % COLS, y: (to / COLS) | 0 },
  ]);
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
