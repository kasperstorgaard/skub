import { encodeMove } from "#/game/strings.ts";
import {
  Board,
  type CellContent,
  Direction,
  Move,
  Piece,
  Position,
  Wall,
} from "#/game/types.ts";

/**
 * The board dimensions.
 * background: 8 rows and cols align well with hex and comp-science,
 * so a useful/fun limit, while providing benefits.
 */
export const COLS = 8;
export const ROWS = 8;

// Generates a square grid of Position objects, board-sized unless told otherwise.
export function getGrid(size = COLS): Position[][] {
  const positions: Position[][] = [];
  for (let y = 0; y < size; y++) {
    positions[y] = [];
    for (let x = 0; x < size; x++) {
      positions[y].push({ x, y });
    }
  }
  return positions;
}

/**
 * Custom error for invalid board states.
 */
export class BoardError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Board type to use when inputting potentially incomplete board data.
 */
export type BoardLike = {
  destination?: Position | null;
  walls: (Wall | null | undefined)[] | undefined | null;
  pieces: (Piece | null | undefined)[] | undefined | null;
  holes?: (Position | null | undefined)[] | undefined | null;
  portals?: (Position | null | undefined)[] | undefined | null;
};

/** A board that has passed validation, so everything a puzzle needs is present. */
export type ValidBoard = Board & { destination: Position };

/** The parts of a board a slide has to consult. */
export type SlideBoard = Pick<
  Board,
  "pieces" | "walls" | "holes" | "portals"
>;

export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

const DELTAS: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/**
 * Checks if a given position is out bounds of the board.
 * @param src The position to check
 * @param size Grid width to check against, for tile-sized grids
 * @returns true if out of bounds, otherwise false
 */
function isPositionOutOfBounds(
  src: Position,
  size = COLS,
) {
  return (
    src.x < 0 ||
    src.x >= size ||
    src.y < 0 ||
    src.y >= size
  );
}

/**
 * Checks if two positions are identical.
 * @param src The source position
 * @param target The target position to compare against.
 * @returns True if identical, otherwise false
 */
export function isPositionSame(src: Position, target: Position) {
  return src.x === target.x && src.y === target.y;
}

/** A board as it may come back from storage, written before hazards existed. */
type StoredBoard =
  & Omit<Board, "holes" | "portals">
  & Partial<Pick<Board, "holes" | "portals">>;

/**
 * Fills in board fields a stored value predates. Editor drafts live in KV as
 * plain objects, so ones saved before holes and portals arrive without them.
 */
export function normalizeBoard(board: StoredBoard): Board {
  return { ...board, holes: board.holes ?? [], portals: board.portals ?? [] };
}

/**
 * What occupies a cell, if anything. Pieces, holes and portals are mutually
 * exclusive, so one answer is always enough.
 */
export function getCellContent(
  { pieces, holes, portals }: Pick<Board, "pieces" | "holes" | "portals">,
  position: Position,
): CellContent | null {
  const piece = pieces.find((item) => isPositionSame(item, position));
  if (piece) return piece.type;

  if (holes.some((hole) => isPositionSame(hole, position))) return "hole";
  if (portals.some((portal) => isPositionSame(portal, position))) {
    return "portal";
  }

  return null;
}

/**
 * Checks if two moves are identical.
 * @param src The source move
 * @param target The target move to compare against.
 * @returns True if identical, otherwise false
 */
export function isMoveSame(src: Move, target: Move) {
  return isPositionSame(src[0], target[0]) && isPositionSame(src[1], target[1]);
}

/** Position code standing in for a piece that fell in a hole. */
export const GONE = COLS * ROWS;

/**
 * Encodes a board into a comparable numeric array:
 * `[puckPos, destPos, ...sortedBlockers, 255, ...sortedWalls, 254, ...sortedHoles,
 * 253, ...sortedPortals]`, where positions are `y*8+x` and walls are
 * `(y*8+x)*2 + (horizontal ? 0 : 1)`. Every list is sorted so array order never
 * depends on input order — portals included, since the pair is symmetric.
 * Wall codes top out at 127, leaving the separators free.
 */
export function encodeBoard(board: Board): number[] {
  const puck = board.pieces.find((p) => p.type === "puck");
  const puckPos = puck ? puck.y * COLS + puck.x : GONE;
  const { destination } = board;
  const destPos = destination ? destination.y * COLS + destination.x : GONE;

  const blockers = board.pieces
    .filter((p) => p.type === "blocker")
    .map((p) => p.y * COLS + p.x)
    .sort((a, b) => a - b);

  const walls = board.walls
    .map((w) =>
      (w.y * COLS + w.x) * 2 + (w.orientation === "horizontal" ? 0 : 1)
    )
    .sort((a, b) => a - b);

  const holes = board.holes
    .map((hole) => hole.y * COLS + hole.x)
    .sort((a, b) => a - b);

  const portals = board.portals
    .map((portal) => portal.y * COLS + portal.x)
    .sort((a, b) => a - b);

  return [
    puckPos,
    destPos,
    ...blockers,
    255,
    ...walls,
    254,
    ...holes,
    253,
    ...portals,
  ];
}

/**
 * Checks if two boards are the same layout, piece and wall order aside.
 * @param src The source board
 * @param target The target board to compare against.
 * @returns True if identical, otherwise false
 */
export function isBoardSame(src: Board, target: Board) {
  const a = encodeBoard(src);
  const b = encodeBoard(target);
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

/**
 * Whether there is anything to solve for yet: something to move, and somewhere
 * to move it.
 *
 * `validateBoard` answers a different question. It rejects a board with no puck
 * or no destination alongside one that is genuinely wrong — a duplicate piece,
 * a third portal — and a board being built is neither for most of its life. Ask
 * this first, and a failure from that is a real one.
 */
export function isReadyToSolve(
  board: Pick<Board, "destination" | "pieces">,
): boolean {
  return board.destination != null &&
    board.pieces.some((piece) => piece.type === "puck");
}

/**
 * Validates the board structure and contents, returning a sanitized Board object.
 * Can be consumed as a truthy check or a means to get a properly typed Board.
 * Will throw BoardError if invalid.
 */
export function validateBoard(board: BoardLike): ValidBoard {
  if (!board) throw new BoardError("Board is missing");

  const { destination, pieces, walls } = board;
  if (!pieces?.length) throw new BoardError("Board has no pieces");

  if (!destination) throw new BoardError("Board has no destination");

  if (isPositionOutOfBounds(destination)) {
    throw new BoardError("Destination is out of bounds");
  }

  const checkedPieces: Piece[] = [];
  for (const piece of pieces) {
    if (piece == null || !piece.type || piece.x == null || piece.y == null) {
      throw new BoardError("Piece is invalid");
    }

    if (isPositionOutOfBounds(piece)) {
      throw new BoardError(
        `Piece at (${piece.x}, ${piece.y}) is out of bounds`,
      );
    }

    const hasIdenticalPieces = checkedPieces.some((checkedPiece) =>
      isPositionSame(piece, checkedPiece)
    );

    if (hasIdenticalPieces) {
      throw new BoardError(`Duplicate piece at (${piece.x}, ${piece.y})`);
    }

    checkedPieces.push(piece);
  }

  const pucks = checkedPieces.filter((piece) => piece.type === "puck");
  if (pucks.length === 0) throw new BoardError("Board has no puck");
  if (pucks.length > 1) throw new BoardError("Board has multiple pucks");

  const checkedWalls = validateWalls(walls ?? []);

  const checkedHoles = validatePositions(board.holes ?? [], "Hole");
  const checkedPortals = validatePositions(board.portals ?? [], "Portal");

  // A pair teleports; a third has nowhere agreed to send anything.
  if (checkedPortals.length > 2) {
    throw new BoardError("Board has more than two portals");
  }

  for (const hazard of [...checkedHoles, ...checkedPortals]) {
    const at = `(${hazard.x}, ${hazard.y})`;

    if (
      checkedHoles.some((hole) => isPositionSame(hole, hazard)) &&
      checkedPortals.some((portal) => isPositionSame(portal, hazard))
    ) {
      throw new BoardError(`Hole and portal share ${at}`);
    }

    if (checkedPieces.some((piece) => isPositionSame(piece, hazard))) {
      throw new BoardError(`Piece starts on a hole or portal at ${at}`);
    }

    if (isPositionSame(destination, hazard)) {
      throw new BoardError(`Destination is on a hole or portal at ${at}`);
    }
  }

  return {
    destination,
    pieces: checkedPieces,
    walls: checkedWalls,
    holes: checkedHoles,
    portals: checkedPortals,
  };
}

/**
 * Bounds- and duplicate-checks a wall list, returning it sanitized.
 *
 * A wall sits on the cell it blocks entry into, so a wall along the low edge
 * would have to be at 0, and one along the high edge would be out of bounds.
 * Both are rejected here, which is what lets a tile-sized grid be composed with
 * its neighbours without ever colliding at a seam.
 */
export function validateWalls(
  walls: (Wall | null | undefined)[],
  size = COLS,
): Wall[] {
  const checked: Wall[] = [];

  for (const wall of walls) {
    if (wall == null || !wall.orientation || wall.x == null || wall.y == null) {
      throw new BoardError("Wall is invalid");
    }

    if (isPositionOutOfBounds(wall, size)) {
      throw new BoardError(`Wall at (${wall.x}, ${wall.y}) is out of bounds`);
    }

    if (wall.orientation === "horizontal" && wall.y === 0) {
      throw new BoardError(`Horizontal wall at y=0 duplicates board edge`);
    }
    if (wall.orientation === "vertical" && wall.x === 0) {
      throw new BoardError(`Vertical wall at x=0 duplicates board edge`);
    }

    if (
      checked.some((checkedWall) =>
        isPositionSame(wall, checkedWall) &&
        wall.orientation === checkedWall.orientation
      )
    ) {
      throw new BoardError(`Duplicate wall at (${wall.x}, ${wall.y})`);
    }

    checked.push(wall);
  }

  return checked;
}

// Bounds- and duplicate-checks a hazard list, returning it sanitized.
export function validatePositions(
  positions: (Position | null | undefined)[],
  label: string,
  size = COLS,
): Position[] {
  const checked: Position[] = [];

  for (const position of positions) {
    if (position == null || position.x == null || position.y == null) {
      throw new BoardError(`${label} is invalid`);
    }

    const at = `(${position.x}, ${position.y})`;

    if (isPositionOutOfBounds(position, size)) {
      throw new BoardError(`${label} at ${at} is out of bounds`);
    }

    if (checked.some((item) => isPositionSame(item, position))) {
      throw new BoardError(`Duplicate ${label.toLowerCase()} at ${at}`);
    }

    checked.push(position);
  }

  return checked;
}

/**
 * The positions in each direction a piece can move to.
 * undefined means the piece cannot move in that direction.
 * empty object means the piece cannot move at all.
 */
export type Targets = {
  up?: Position;
  right?: Position;
  down?: Position;
  left?: Position;
};

/** How a slide ended. */
export type SlideOutcome = "stopped" | "dropped" | "looped";

/**
 * A resolved slide in one direction.
 *
 * `segments` holds one entry per portal leg — the cells crossed, starting at the
 * origin or at an exit portal — so callers can animate and measure the real path
 * instead of interpolating between the endpoints.
 */
export type Slide = {
  segments: Position[][];
  // Where the piece ends: a resting cell, the hole it fell into, or the portal
  // it was caught circling.
  target: Position;
  outcome: SlideOutcome;
};

/**
 * Whether a wall stands between two adjacent cells. Walls are stored on the cell
 * they block entry into from the lower coordinate, so the wall to look for
 * always sits on whichever of the two is further along the axis.
 */
function hasWallBetween(from: Position, to: Position, walls: Wall[]) {
  const orientation = from.y === to.y ? "vertical" : "horizontal";
  const at = to.x > from.x || to.y > from.y ? to : from;

  return walls.some((wall) =>
    wall.orientation === orientation && isPositionSame(wall, at)
  );
}

/**
 * Walks a piece one cell at a time until something ends the slide.
 *
 * A step-by-step walk rather than a clamp from the board edge, because holes and
 * portals act on the cells crossed on the way, not on where the slide would
 * otherwise have stopped.
 *
 * @param src The starting position
 * @param direction The direction to slide in
 * @param board The board state
 * @returns The resolved slide, or undefined if no piece stands on `src`
 */
export function getSlide(
  src: Position,
  direction: Direction,
  { pieces, walls, holes, portals }: SlideBoard,
): Slide | undefined {
  if (!pieces.some((piece) => isPositionSame(piece, src))) return undefined;

  const delta = DELTAS[direction];
  // The mover cannot block itself — every other piece can.
  const isBlocked = (position: Position) =>
    pieces.some((piece) =>
      !isPositionSame(piece, src) && isPositionSame(piece, position)
    );

  const entered: Position[] = [];
  let current = src;
  let segment: Position[] = [current];
  const segments = [segment];

  while (true) {
    const next = { x: current.x + delta.x, y: current.y + delta.y };

    if (isPositionOutOfBounds(next)) break;
    if (hasWallBetween(current, next, walls)) break;
    if (isBlocked(next)) break;

    current = next;
    segment.push(current);

    if (holes.some((hole) => isPositionSame(hole, current))) {
      return { segments, target: current, outcome: "dropped" };
    }

    const entry = portals.find((portal) => isPositionSame(portal, current));
    if (!entry) continue;

    // A single portal has nowhere to send anything, so pieces slide over it.
    const exit = portals.find((portal) => !isPositionSame(portal, entry));
    if (!exit) continue;

    // Back into a portal already taken this slide: the piece circles forever.
    if (entered.some((portal) => isPositionSame(portal, entry))) {
      return { segments, target: current, outcome: "looped" };
    }
    entered.push(entry);

    // Nothing can come through an occupied exit, so the piece stays on entry.
    if (isBlocked(exit)) {
      return { segments, target: entry, outcome: "stopped" };
    }

    current = exit;
    segment = [current];
    segments.push(segment);
  }

  return { segments, target: current, outcome: "stopped" };
}

/**
 * Every direction the piece on `src` can actually travel in.
 * A direction that would leave it where it started is not a move.
 */
export function getSlides(
  src: Position,
  board: SlideBoard,
): Partial<Record<Direction, Slide>> {
  const slides: Partial<Record<Direction, Slide>> = {};

  for (const direction of DIRECTIONS) {
    const slide = getSlide(src, direction, board);
    if (!slide || isPositionSame(slide.target, src)) continue;

    slides[direction] = slide;
  }

  return slides;
}

/**
 * Gets the furthest possible position a piece can move in each direction,
 * blocked by walls, other pieces and board edges — or swallowed by a hole.
 *
 * An empty direction means the piece cannot move in that direction.
 * An empty object means the piece cannot move at all.
 *
 * @param src The starting position
 * @param board The board state
 * @returns The possible target positions of the piece
 */
export function getTargets(src: Position, board: SlideBoard): Targets {
  const lookup: Targets = {};

  for (const [direction, slide] of Object.entries(getSlides(src, board))) {
    lookup[direction as keyof Targets] = slide.target;
  }

  return lookup;
}

/**
 * Recovers the slide a move describes.
 *
 * A move only records where a piece ended, so the direction has to be found by
 * matching endpoints. First match in `DIRECTIONS` order wins, which only becomes
 * a choice at all on boards where two portal routes share an endpoint.
 */
export function getMoveSlide(
  move: Move,
  board: SlideBoard,
): Slide | undefined {
  const slides = getSlides(move[0], board);

  for (const direction of DIRECTIONS) {
    const slide = slides[direction];
    if (slide && isPositionSame(slide.target, move[1])) return slide;
  }

  return undefined;
}

/**
 * Check if a move between to positions is valid given a board state.
 * @param move
 * @param board
 * @returns true if valid, otherwise false
 */
export function isValidMove(move: Move, board: SlideBoard) {
  return getMoveSlide(move, board) != null;
}

/**
 * Resolves a series of moves given a board state.
 * Will throw if any move is not valid.
 * @param board
 * @param moves
 * @returns updated board state.
 */
export function resolveMoves<TBoard extends SlideBoard = SlideBoard>(
  board: TBoard,
  moves: Move[],
): TBoard {
  let updatedBoard = { ...board };

  for (const move of moves) {
    const slide = getMoveSlide(move, updatedBoard);
    if (!slide) throw new Error(`Invalid move: ${encodeMove(move)}`);

    updatedBoard = {
      ...updatedBoard,
      pieces: slide.outcome === "dropped"
        ? updatedBoard.pieces.filter((piece) => !isPositionSame(piece, move[0]))
        : updatedBoard.pieces.map((piece) =>
          isPositionSame(piece, move[0]) ? { ...piece, ...move[1] } : piece
        ),
    };
  }

  return updatedBoard;
}

/**
 * Whether the last move left a piece circling between two portals.
 *
 * Derived rather than stored: moves live in the URL, so a reloaded or shared
 * link has to arrive at the same locked board, with or without JavaScript.
 */
export function isLooped(board: SlideBoard, moves: Move[]) {
  const lastMove = moves.at(-1);
  if (!lastMove) return false;

  const before = resolveMoves(board, moves.slice(0, -1));
  return getMoveSlide(lastMove, before)?.outcome === "looped";
}

/**
 * Check if the current board state is a valid solution
 * @param board The current board state
 * @returns true if valid solution, otherwise false
 */
export function isValidSolution(board: Pick<Board, "destination" | "pieces">) {
  // A board still being built has nowhere to reach.
  if (!board.destination) return false;

  for (const piece of board.pieces) {
    if (piece.type === "blocker") continue;

    if (board.destination && isPositionSame(piece, board.destination)) {
      return true;
    }
  }

  return false;
}

/** Whether a cell has nothing standing on it that a piece could not share. */
export function isCellFree(
  board: Pick<Board, "pieces" | "holes" | "portals">,
  position: Position,
): boolean {
  return !board.pieces.some((piece) =>
    piece.type === "blocker" && isPositionSame(piece, position)
  ) &&
    !board.holes.some((hole) => isPositionSame(hole, position)) &&
    !board.portals.some((portal) => isPositionSame(portal, position));
}

/** Enough throws to find two free cells; past that the board has none. */
const MAX_DICE_ROLLS = 40;

/**
 * Throws the dice for a puck and a destination, the way the tabletop game does:
 * one die for the column, one for the row.
 *
 * Every throw is kept, landings and misses alike — a die that comes down on a
 * blocker is thrown again, and the sequence records that rather than hiding it.
 * The last entry in each list is where the piece ends up.
 */
export function rollDice(
  board: Pick<Board, "pieces" | "holes" | "portals">,
  { random = Math.random }: { random?: () => number } = {},
): { puck: Position[]; destination: Position[] } {
  const rollUntil = (accepts: (position: Position) => boolean): Position[] => {
    const thrown: Position[] = [];

    for (let attempt = 0; attempt < MAX_DICE_ROLLS; attempt++) {
      const position = {
        x: Math.floor(random() * COLS),
        y: Math.floor(random() * ROWS),
      };

      thrown.push(position);
      if (accepts(position)) return thrown;
    }

    throw new BoardError("The dice found nowhere free to land");
  };

  const puck = rollUntil((position) => isCellFree(board, position));
  const landed = puck[puck.length - 1];

  const destination = rollUntil((position) =>
    isCellFree(board, position) && !isPositionSame(position, landed)
  );

  return { puck, destination };
}

/**
 * Rotates a board 90° in the given direction.
 * Wall orientations swap (horizontal ↔ vertical) and positions shift
 * to preserve the same logical barriers on the rotated grid.
 */
export function rotateBoard(
  board: Board,
  direction: "right" | "left",
  { size = COLS }: { size?: number } = {},
): Board {
  const destination = board.destination &&
    rotatePosition(board.destination, direction, size);
  const pieces = board.pieces.map((piece) =>
    rotatePosition(piece, direction, size)
  );
  const walls = board.walls.map((wall) =>
    rotatePosition(wall, direction, size)
  );
  const holes = board.holes.map((hole) =>
    rotatePosition(hole, direction, size)
  );
  const portals = board.portals.map((portal) =>
    rotatePosition(portal, direction, size)
  );

  return { destination, pieces, walls, holes, portals };
}

// Rotates a position or wall 90° right. Walls swap orientation and use a shifted x offset.
function rotatePosition<TItem extends Position | Wall>(
  item: TItem,
  direction: "right" | "left" = "right",
  size = COLS,
): TItem {
  if (direction !== "right") {
    // Rotate right 3 times
    return rotatePosition(
      rotatePosition(rotatePosition(item, "right", size), "right", size),
      "right",
      size,
    );
  }

  const wall = "orientation" in item ? item as Wall : null;

  if (wall) {
    if (wall.orientation === "horizontal") {
      return {
        ...item,
        x: size - wall.y,
        y: wall.x,
        orientation: "vertical",
      };
    } else {
      return {
        ...item,
        x: size - 1 - wall.y,
        y: wall.x,
        orientation: "horizontal",
      };
    }
  }

  return { ...item, x: size - 1 - item.y, y: item.x };
}

/**
 * Flips a board along the given axis.
 * "horizontal" mirrors left ↔ right, "vertical" mirrors up ↔ down.
 * Wall orientations stay the same but positions shift to preserve barriers.
 */
export function flipBoard(
  board: Board,
  axis: "horizontal" | "vertical",
  { size = COLS }: { size?: number } = {},
): Board {
  const destination = board.destination &&
    flipPosition(board.destination, axis, size);
  const pieces = board.pieces.map((piece) => flipPosition(piece, axis, size));
  const walls = board.walls.map((wall) => flipPosition(wall, axis, size));
  const holes = board.holes.map((hole) => flipPosition(hole, axis, size));
  const portals = board.portals.map((portal) =>
    flipPosition(portal, axis, size)
  );

  return { destination, pieces, walls, holes, portals };
}

// Flips a position or wall along an axis. Cross-axis walls get a +1 offset to preserve edge alignment.
function flipPosition<TItem extends Position | Wall>(
  item: TItem,
  axis: "horizontal" | "vertical",
  size = COLS,
): TItem {
  const wall = "orientation" in item ? item as Wall : null;

  if (wall) {
    const offset = wall.orientation !== axis ? 1 : 0;

    return {
      ...item,
      x: axis === "horizontal" ? size - 1 - item.x + offset : item.x,
      y: axis === "vertical" ? size - 1 - item.y + offset : item.y,
    };
  }

  return {
    ...item,
    x: axis === "horizontal" ? size - 1 - item.x : item.x,
    y: axis === "vertical" ? size - 1 - item.y : item.y,
  };
}
