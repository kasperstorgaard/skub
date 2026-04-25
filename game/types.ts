// Cardinal direction for piece movement
export type Direction = "up" | "right" | "down" | "left";

// A coordinate on the board grid
export type Position = {
  x: number;
  y: number;
};

// A game piece (puck or blocker) placed on the board
export type Piece = Position & {
  type: "puck" | "blocker";
};

// A wall segment that blocks piece movement
export type Wall = Position & {
  orientation: "horizontal" | "vertical";
};

// The complete board state with destination, walls, and pieces
export type Board = {
  destination: Position;
  walls: Wall[];
  pieces: Piece[];
};

// "ultra" is a one-off tier for "Loke" — the hidden endgame puzzle shown
// when a player has solved every other puzzle at minimum moves.
export const DIFFICULTIES = ["easy", "medium", "hard", "ultra"] as const;
export type Difficulty = typeof DIFFICULTIES[number];

export type SkillLevel = "beginner" | "intermediate" | "expert";

// A move represented as a pair of positions [from, to]
export type Move = [Position, Position];

// A complete puzzle with metadata and board configuration
export type Puzzle = {
  number?: number;
  slug: string;
  name: string;
  board: Board;
  createdAt: Date;
  difficulty: Difficulty;
  minMoves: number;
  onboardingLevel?: number;
  hidden?: boolean;
};

// Lightweight puzzle entry used in the manifest index
export type PuzzleManifestEntry = Pick<
  Puzzle,
  | "number"
  | "slug"
  | "name"
  | "createdAt"
  | "minMoves"
  | "difficulty"
  | "onboardingLevel"
  | "hidden"
>;

// Tracks current pagination position and total counts
export type PaginationState = {
  page: number;
  totalItems: number;
  totalPages: number;
  itemsPerPage: number;
};

// A paginated response containing items and pagination metadata
export type PaginatedData<T> = {
  items: T[];
  pagination: PaginationState;
};

// Aggregate stats for a puzzle, maintained as best-effort alongside solution writes
export type PuzzleStats = {
  totalSolutions: number;
  solutionsHistogram: Record<number, number>; // moveCount → frequency
  firstSolvedAt?: string; // ISO date, set on first solve
  uniqueSolvers: number; // deduplicated by userId; anon sessions counted separately
  hintUsageCount: number;
};
